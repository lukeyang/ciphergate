from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CategoryProfiles:
    harassment: list[float]
    threat: list[float]
    sexual: list[float]


@dataclass(frozen=True)
class CategorySeeds:
    harassment: list[float]
    threat: list[float]
    sexual: list[float]


@dataclass(frozen=True)
class ProfileWeights:
    semantic_weight: float
    signal_weight: float


_RUNTIME_ROOT = Path(os.getenv("POLICY_RUNTIME_ROOT", str(Path.cwd()))).resolve()
_DEFAULT_POLICY_CONFIG_DIR = _RUNTIME_ROOT / "config" / "policy"
_POLICY_CONFIG_DIR = Path(os.getenv("POLICY_CONFIG_DIR", str(_DEFAULT_POLICY_CONFIG_DIR)))
if not _POLICY_CONFIG_DIR.is_absolute():
    _POLICY_CONFIG_DIR = (_RUNTIME_ROOT / _POLICY_CONFIG_DIR).resolve()
_POLICY_PRESET = os.getenv("POLICY_PRESET", "").strip()
_EFFECTIVE_POLICY_DIR = (
    (_POLICY_CONFIG_DIR / "presets" / _POLICY_PRESET)
    if _POLICY_PRESET
    else _POLICY_CONFIG_DIR
)
_DEFAULT_SEEDS_PATH = _EFFECTIVE_POLICY_DIR / "category-seeds.json"
_DEFAULT_SAAS_PROFILE_PATH = _EFFECTIVE_POLICY_DIR / "saas-profile.json"


def _resolve_path(env_name: str, fallback: Path) -> Path:
    raw = os.getenv(env_name)
    if not raw:
        return fallback
    candidate = Path(raw.strip())
    if candidate.is_absolute():
        return candidate
    return (_RUNTIME_ROOT / candidate).resolve()


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Policy config file not found: {path}")
    with path.open("r", encoding="utf-8") as fp:
        parsed = json.load(fp)
    if not isinstance(parsed, dict):
        raise ValueError(f"Policy config JSON must be an object: {path}")
    return parsed


def _read_number_list(root: dict[str, Any], key: str, file_path: Path) -> list[float]:
    raw = root.get(key)
    if not isinstance(raw, list) or len(raw) == 0:
        raise ValueError(f"{file_path}: '{key}' must be a non-empty array")

    out: list[float] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, (int, float)):
            raise ValueError(f"{file_path}: '{key}[{idx}]' must be a number")
        out.append(float(item))
    return out


def _read_number(root: dict[str, Any], key: str, file_path: Path) -> float:
    raw = root.get(key)
    if not isinstance(raw, (int, float)):
        raise ValueError(f"{file_path}: '{key}' must be a number")
    return float(raw)


def load_category_seeds() -> CategorySeeds:
    path = _resolve_path("POLICY_SEEDS_PATH", _DEFAULT_SEEDS_PATH)
    root = _read_json(path)
    return CategorySeeds(
        harassment=_read_number_list(root, "harassment", path),
        threat=_read_number_list(root, "threat", path),
        sexual=_read_number_list(root, "sexual", path),
    )


def load_profile_weights() -> ProfileWeights:
    path = _resolve_path("POLICY_SERVER_PROFILE_CONFIG_PATH", _DEFAULT_SAAS_PROFILE_PATH)
    root = _read_json(path)
    semantic = _read_number(root, "semanticWeight", path)
    signal = _read_number(root, "signalWeight", path)

    if semantic < 0 or signal < 0:
        raise ValueError(f"{path}: semanticWeight/signalWeight must be >= 0")

    total = semantic + signal
    if total <= 0:
        raise ValueError(f"{path}: semanticWeight + signalWeight must be > 0")

    return ProfileWeights(
        semantic_weight=semantic / total,
        signal_weight=signal / total,
    )


def _expand_seed(seed: list[float], embedding_dim: int) -> list[float]:
    if embedding_dim <= 0:
        return []
    if not seed:
        return [0.0] * embedding_dim

    expanded = [0.0] * embedding_dim
    for i in range(embedding_dim):
        expanded[i] = seed[i % len(seed)]

    norm = math.sqrt(sum(v * v for v in expanded)) or 1.0
    return [v / norm for v in expanded]


def build_profiles(vector_size: int) -> CategoryProfiles:
    if vector_size < 3:
        raise ValueError("ciphertext vector must contain at least 3 dimensions")

    embedding_dim = vector_size - 3
    seeds = load_category_seeds()
    weights = load_profile_weights()

    h_emb = _expand_seed(seeds.harassment, embedding_dim) if embedding_dim > 0 else []
    t_emb = _expand_seed(seeds.threat, embedding_dim) if embedding_dim > 0 else []
    s_emb = _expand_seed(seeds.sexual, embedding_dim) if embedding_dim > 0 else []

    def _make_profile(emb: list[float], signal_index: int) -> list[float]:
        profile = [v * weights.semantic_weight for v in emb]
        signals = [0.0, 0.0, 0.0]
        signals[signal_index] = weights.signal_weight
        profile.extend(signals)
        return profile

    return CategoryProfiles(
        harassment=_make_profile(h_emb, 0),
        threat=_make_profile(t_emb, 1),
        sexual=_make_profile(s_emb, 2),
    )


def tuning_metadata() -> dict[str, str]:
    return {
        "policy_config_dir": str(_POLICY_CONFIG_DIR),
        "policy_preset": _POLICY_PRESET or "default",
        "effective_policy_dir": str(_EFFECTIVE_POLICY_DIR),
    }
