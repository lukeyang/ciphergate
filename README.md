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
GEMINI_EMBED_MODEL=models/text-embedding-004
GEMINI_CHAT_MODEL=models/gemini-2.5-pro
```

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
  - output: policy event list for monitor dashboard

### SaaS policy server

- `POST /score`
  - input: `{ session_id, ciphertext_embedding }` (`ciphertext_embedding` is base64 CKKS ciphertext)
  - output: `{ harassment, threat, sexual }` (all base64 CKKS ciphertext)

## Dockerfiles

- Customer app: `customer-app.Dockerfile`
- Policy server: `policy-server/Dockerfile`
