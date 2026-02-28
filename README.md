# CipherGate MVP + Voice Extension 1

Zero-knowledge policy enforcement demo for AI customer support.

## What this repository contains

- Customer app: Next.js + TypeScript (chat UI, voice mode, customer gateway policy flow)
- SaaS policy server: FastAPI + TenSEAL (CKKS encrypted scoring only)

Policy categories are limited to:

- Harassment
- Threat
- Sexual Misconduct

## Security boundaries (enforced)

- SaaS policy server never loads or stores the secret key.
- SaaS policy server never decrypts ciphertext.
- Customer plaintext is never sent to the SaaS server.
- Decryption happens only in customer gateway.
- Only encrypted embeddings are sent to `/score`.

## Prerequisites

- Node.js 20+
- Python 3.11

## Environment variables (customer app)

Create `.env.local` at repo root:

```bash
GEMINI_API_KEY=your_gemini_api_key
POLICY_SERVER_URL=http://127.0.0.1:8001
PYTHON_BIN=.venv/bin/python
GEMINI_EMBED_MODEL=models/gemini-embedding-001
GEMINI_CHAT_MODEL=models/gemini-2.5-flash
GEMINI_CHAT_MODEL_FALLBACKS=models/gemini-2.5-pro,models/gemini-1.5-flash
GEMINI_CHAT_TIMEOUT_MS=7000
GEMINI_SUPPORT_PROMPT_FILE=prompts/support-agent.system.txt
POLICY_PRESET=default
# Optional overrides:
# POLICY_CONFIG_DIR=config/policy
# LOCAL_POLICY_CONFIG_PATH=config/policy/local-policy.json
# POLICY_DECISION_CONFIG_PATH=config/policy/decision-thresholds.json
# POLICY_SEEDS_CONFIG_PATH=config/policy/category-seeds.json
```

Edit `prompts/support-agent.system.txt` to change support-agent persona without touching application code.

## Run policy-server

```bash
python3.11 -m venv .venv --clear
source .venv/bin/activate
pip install -r policy-server/requirements.txt
PYTHON_BIN=.venv/bin/python bash scripts/setup_crypto.sh
uvicorn app.main:app --app-dir policy-server --host 0.0.0.0 --port 8001
```

Health check:

```bash
curl -sS http://127.0.0.1:8001/health
```

Expected output includes:

- `"secret_key":"NOT PRESENT"`
- `"plaintext_stored":"NO"`

## Run customer app

```bash
npm install
npm run dev
```

Open:

- Chat UI: `http://localhost:3000`
- Monitor UI: `http://localhost:3000/monitor`

## Demo flow

1. Open chat UI and send a normal support request.
   - Expected: `ALLOW`, Gemini chat response generated.
2. Send harassment text (example):
   - `you are an idiot and a stupid moron`
   - Expected: `BLOCK` with `harassment`.
3. Send threat text (example):
   - `I will kill and retaliate, watch your back`
   - Expected: `BLOCK` with `threat`.
4. Send sexual misconduct text (example):
   - `you are sexy and I want sex now`
   - Expected: `BLOCK` with `sexual`.
5. After `BLOCK`, session remains terminated and further requests in same session stay blocked.

## Voice mode demo

1. In chat UI, enable `Voice Mode: ON`.
2. Click `Start Listening`.
3. Speak a sentence; transcript is sent through the same `/api/policy-check` pipeline.
4. On `BLOCK`, voice listening stops and session is terminated.

## API contracts

### Customer gateway

- `POST /api/policy-check`
  - input: `{ sessionId, message }`
  - output: decision, category, confidence, decrypted scores, blocked status, optional reply

- `GET /api/monitor`
  - output: policy event list + debug traces + active tuning config paths

### SaaS policy server

- `POST /score`
  - input: `{ session_id, ciphertext_embedding }` (`ciphertext_embedding` is base64 CKKS ciphertext)
  - output: `{ harassment, threat, sexual }` (all base64 CKKS ciphertext)

## Dockerfiles

- Customer app: `customer-app.Dockerfile`
- Policy server: `policy-server/Dockerfile`

## Policy tuning files (no code change needed)

All policy tuning is file-driven under `config/policy`:

- `local-policy.json`: regex patterns + local scoring weights
- `decision-thresholds.json`: ALLOW/BLOCK thresholds
- `category-seeds.json`: category semantic seed vectors
- `saas-profile.json`: SaaS encrypted profile weighting

Preset examples are included:

- `config/policy/presets/strict/*`
- `config/policy/presets/relaxed/*`

Switch preset with:

```bash
POLICY_PRESET=strict
```

Both customer app and policy-server read the same preset name at runtime.

## Cloud Run deployment (one command)

This architecture deploys **two Cloud Run services**:

1. `policy-server` (SaaS scoring only, no secret key, no plaintext)
2. `customer-app` (gateway + secret key + decrypt + UI)

Two services are required to preserve the zero-knowledge boundary.

### Quick deploy

```bash
cp .env.deploy.example .env.deploy
# edit .env.deploy and set GEMINI_API_KEY + GCP project values
./preflight.sh
./deploy.sh
```

`deploy.sh` performs:

1. CKKS key material check/generation (`scripts/setup_crypto.sh`)
2. Artifact Registry setup
3. Build + deploy `policy-server`
4. Build + deploy `customer-app` with `POLICY_SERVER_URL` wired automatically

After completion, the script prints both Cloud Run URLs.

Build efficiency notes:

- Deploy uses Docker (Cloud Build + Dockerfiles).
- Cloud Build files pull previous images and use `--cache-from` for layer reuse.
- Next telemetry is disabled in container builds (`NEXT_TELEMETRY_DISABLED=1`).

`preflight.sh` checks account/project/billing/API/env/key-material readiness and exits non-zero when required conditions are missing.

`deploy.sh` automatically sets customer `POLICY_SERVER_URL` to the just-deployed policy-server URL.  
Only use `DEPLOY_POLICY_SERVER_URL` when you intentionally want to point customer-app to an external existing policy service.

For stable monitor behavior in Cloud Run demo mode, deploy defaults to:

- `CUSTOMER_MIN_INSTANCES=1`
- `CUSTOMER_MAX_INSTANCES=1`
- `CUSTOMER_CONCURRENCY=1`
- `CIPHERGATE_RUNTIME_DIR=/tmp/ciphergate` (ephemeral runtime files)
