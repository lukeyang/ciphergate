#!/usr/bin/env bash
# Record CipherGate demo video — English version
# Usage: ./demoen.sh [output_path]
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate
python scripts/demo_record.py --lang en ${1:+--output "$1"}
echo ""
echo "English demo video saved to demo_output/ciphergate_demo_en.mp4"
