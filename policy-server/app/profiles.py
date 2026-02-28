from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryProfiles:
    harassment: list[float]
    threat: list[float]
    sexual: list[float]


# ---------------------------------------------------------------------------
# Semantic seed vectors (32-dim) – these capture each category's directional
# signature in embedding space.  They are stretched / zero-padded to match the
# actual embedding portion of the policy vector.
# ---------------------------------------------------------------------------

_HARASSMENT_SEED: list[float] = [
    0.39, 0.31, 0.27, 0.16, 0.10, 0.11, 0.08, 0.26,
    0.35, 0.28, 0.22, 0.13, 0.10, 0.09, 0.20, 0.30,
    0.24, 0.18, 0.17, 0.14, 0.16, 0.22, 0.29, 0.25,
    0.19, 0.10, 0.08, 0.15, 0.21, 0.27, 0.25, 0.20,
]

_THREAT_SEED: list[float] = [
    0.11, 0.14, 0.20, 0.34, 0.36, 0.31, 0.28, 0.18,
    0.16, 0.13, 0.10, 0.22, 0.26, 0.30, 0.35, 0.38,
    0.33, 0.29, 0.23, 0.19, 0.17, 0.12, 0.09, 0.14,
    0.20, 0.24, 0.31, 0.34, 0.30, 0.25, 0.19, 0.16,
]

_SEXUAL_SEED: list[float] = [
    0.16, 0.18, 0.12, 0.08, 0.11, 0.15, 0.24, 0.33,
    0.37, 0.34, 0.29, 0.22, 0.17, 0.13, 0.10, 0.09,
    0.14, 0.20, 0.26, 0.32, 0.36, 0.33, 0.28, 0.21,
    0.17, 0.15, 0.18, 0.24, 0.31, 0.35, 0.30, 0.23,
]

# Stronger emphasis on customer-side signal so explicit threat keywords
# are not diluted below policy thresholds after encrypted dot-product.
_SEMANTIC_WEIGHT = 0.12
_SIGNAL_WEIGHT = 0.88


def _expand_seed(seed: list[float], embedding_dim: int) -> list[float]:
    """Tile / zero-pad a short seed vector to *embedding_dim* and L2-normalise."""
    if embedding_dim <= 0:
        return []
    if not seed:
        return [0.0] * embedding_dim

    expanded = [0.0] * embedding_dim
    for i in range(embedding_dim):
        expanded[i] = seed[i % len(seed)]
    # L2-normalise so dot-product ≈ cosine contribution
    norm = math.sqrt(sum(v * v for v in expanded)) or 1.0
    return [v / norm for v in expanded]


def build_profiles(vector_size: int) -> CategoryProfiles:
    """Build per-category profile vectors of length *vector_size*.

    Layout of the incoming policy-vector (set by customer gateway):
        [embedding (vector_size-3)] + [harassment_signal, threat_signal, sexual_signal]

    The profile mixes:
      • a semantic weight across the embedding dimensions, and
      • a direct weight on the corresponding signal slot.
    """
    if vector_size < 3:
        raise ValueError("ciphertext vector must contain at least 3 dimensions")

    embedding_dim = vector_size - 3

    h_emb = _expand_seed(_HARASSMENT_SEED, embedding_dim) if embedding_dim > 0 else []
    t_emb = _expand_seed(_THREAT_SEED, embedding_dim) if embedding_dim > 0 else []
    s_emb = _expand_seed(_SEXUAL_SEED, embedding_dim) if embedding_dim > 0 else []

    def _make_profile(
        emb: list[float], signal_index: int,
    ) -> list[float]:
        # Scale embedding part
        profile = [v * _SEMANTIC_WEIGHT for v in emb]
        # Append 3 signal slots
        signals = [0.0, 0.0, 0.0]
        signals[signal_index] = _SIGNAL_WEIGHT
        profile.extend(signals)
        return profile

    return CategoryProfiles(
        harassment=_make_profile(h_emb, 0),
        threat=_make_profile(t_emb, 1),
        sexual=_make_profile(s_emb, 2),
    )
