#!/usr/bin/env bash
# Record CipherGate demo video — Korean version
# Usage: ./demokr.sh [output_path]
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate
python scripts/demo_record.py --lang kr ${1:+--output "$1"}
echo ""
echo "Korean demo video saved to demo_output/ciphergate_demo_kr.mp4"
