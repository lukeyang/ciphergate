#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import sys
from pathlib import Path
from typing import Any

import tenseal as ts


def create_context() -> ts.Context:
    context = ts.context(
        ts.SCHEME_TYPE.CKKS,
        poly_modulus_degree=8192,
        coeff_mod_bit_sizes=[60, 40, 40, 60],
    )
    context.global_scale = 2**40
    context.generate_galois_keys()
    context.generate_relin_keys()
    return context


def write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def load_secret_context(secret_path: Path) -> ts.Context:
    if not secret_path.exists():
        raise FileNotFoundError(f"Secret context not found: {secret_path}")
    return ts.context_from(secret_path.read_bytes())


def command_init(args: argparse.Namespace) -> dict[str, str]:
    context = create_context()

    secret_payload = context.serialize(
        save_public_key=True,
        save_secret_key=True,
        save_galois_keys=True,
        save_relin_keys=True,
    )
    public_payload = context.serialize(
        save_public_key=True,
        save_secret_key=False,
        save_galois_keys=True,
        save_relin_keys=True,
    )

    secret_path = Path(args.secret_path)
    public_path = Path(args.public_path)
    write_bytes(secret_path, secret_payload)
    write_bytes(public_path, public_payload)

    if args.policy_public_path:
        policy_public_path = Path(args.policy_public_path)
        write_bytes(policy_public_path, public_payload)

    return {
        "status": "ok",
        "secret_path": str(secret_path),
        "public_path": str(public_path),
    }


def parse_stdin_json() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("JSON stdin payload is required")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("stdin payload must be a JSON object")
    return parsed


def command_encrypt(args: argparse.Namespace) -> dict[str, Any]:
    payload = parse_stdin_json()
    vector_raw = payload.get("vector")

    if not isinstance(vector_raw, list) or len(vector_raw) == 0:
        raise ValueError("vector must be a non-empty list")

    vector = [float(value) for value in vector_raw]
    context = load_secret_context(Path(args.secret_path))
    encrypted = ts.ckks_vector(context, vector)

    return {
        "ciphertext_embedding": base64.b64encode(encrypted.serialize()).decode("ascii"),
        "vector_size": len(vector),
    }


def decrypt_single(context: ts.Context, encoded_ciphertext: str) -> float:
    encrypted = ts.ckks_vector_from(context, base64.b64decode(encoded_ciphertext))
    values = encrypted.decrypt()
    if not values:
        return 0.0
    return float(values[0])


def command_decrypt(args: argparse.Namespace) -> dict[str, float]:
    payload = parse_stdin_json()
    encoded_scores = payload.get("scores")

    if not isinstance(encoded_scores, dict):
        raise ValueError("scores must be an object")

    context = load_secret_context(Path(args.secret_path))
    harassment = decrypt_single(context, str(encoded_scores.get("harassment", "")))
    threat = decrypt_single(context, str(encoded_scores.get("threat", "")))
    sexual = decrypt_single(context, str(encoded_scores.get("sexual", "")))

    return {
        "harassment": harassment,
        "threat": threat,
        "sexual": sexual,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CipherGate customer-side crypto bridge")
    sub = parser.add_subparsers(dest="command", required=True)

    init_parser = sub.add_parser("init", help="Create customer secret context and public context")
    init_parser.add_argument("--secret-path", required=True)
    init_parser.add_argument("--public-path", required=True)
    init_parser.add_argument("--policy-public-path", required=False)

    encrypt_parser = sub.add_parser("encrypt", help="Encrypt embedding vector")
    encrypt_parser.add_argument("--secret-path", required=True)

    decrypt_parser = sub.add_parser("decrypt", help="Decrypt encrypted policy scores")
    decrypt_parser.add_argument("--secret-path", required=True)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "init":
            output = command_init(args)
        elif args.command == "encrypt":
            output = command_encrypt(args)
        elif args.command == "decrypt":
            output = command_decrypt(args)
        else:
            raise ValueError("Unsupported command")

        sys.stdout.write(json.dumps(output))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"crypto_bridge_error: {exc}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
