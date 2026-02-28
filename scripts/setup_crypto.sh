#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
SECRET_PATH="customer-gateway/keys/secret_context.seal"
PUBLIC_PATH="customer-gateway/keys/public_context.seal"
POLICY_PUBLIC_PATH="policy-server/keys/public_context.seal"

mkdir -p customer-gateway/keys policy-server/keys

"${PYTHON_BIN}" scripts/crypto_bridge.py init \
  --secret-path "${SECRET_PATH}" \
  --public-path "${PUBLIC_PATH}" \
  --policy-public-path "${POLICY_PUBLIC_PATH}"

echo "Crypto context prepared."
echo "- Secret context: ${SECRET_PATH}"
echo "- Public context: ${PUBLIC_PATH}"
echo "- Policy-server public context: ${POLICY_PUBLIC_PATH}"
