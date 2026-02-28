# ExecPlan

## M1: Text Chat MVP (Phase 1)
Status: M1 DONE

Files to create/modify:
- `package.json`
- `tsconfig.json`
- `next.config.mjs`
- `next-env.d.ts`
- `.gitignore`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/api/policy-check/route.ts`
- `src/lib/gemini.ts`
- `src/lib/local-policy.ts`
- `src/lib/policy.ts`
- `src/lib/session-store.ts`
- `src/lib/types.ts`

Commands to run:
- `npm install`
- `npm run dev`

Acceptance checks:
- Customer app starts successfully in dev mode.
- Chat UI accepts message, calls `/api/policy-check`, and renders decision.
- Policy decision logic uses only categories: `harassment`, `threat`, `sexual`.
- Gemini chat response is only generated when decision is `ALLOW`.
- Session is terminated/blocked after `BLOCK` decision.

Notes:
- Completed Next.js TypeScript bootstrap, chat UI, `/api/policy-check`, local policy engine, session block store, Gemini embed/chat integration with fallback.
- Verified API responses for `ALLOW` and `BLOCK`, including persistent session termination on subsequent requests.
- `npm install` required escalated execution due sandbox DNS limits; completed successfully.
- `npm run dev` required escalated execution due sandbox port bind restriction (`EPERM` without escalation).

## M2: SaaS Policy Server (FastAPI) + wiring from Customer Gateway (Phase 3 + Phase 4)
Status: M2 DONE

Files to create/modify:
- `policy-server/requirements.txt`
- `policy-server/app/main.py`
- `policy-server/app/models.py`
- `policy-server/app/security.py`
- `policy-server/app/profiles.py`
- `policy-server/.env.example`
- `policy-server/Dockerfile`
- `scripts/crypto_bridge.py`
- `scripts/setup_crypto.sh`
- `customer-app.Dockerfile`
- `src/lib/crypto-bridge.ts`
- `src/lib/policy-server.ts`
- `src/app/api/policy-check/route.ts` (wire encrypted flow)
- `src/lib/monitor-store.ts`

Commands to run:
- `python3 -m venv .venv && source .venv/bin/activate && pip install -r policy-server/requirements.txt`
- `bash scripts/setup_crypto.sh`
- `uvicorn policy-server.app.main:app --host 0.0.0.0 --port 8001`
- `npm run dev`

Acceptance checks:
- `policy-server` exposes `POST /score` with schema:
  - input: `{ session_id, ciphertext_embedding }`
  - output: `{ harassment, threat, sexual }` (all base64 ciphertext)
- SaaS server does not generate/load/store secret key.
- SaaS server does not decrypt ciphertext.
- Customer Gateway generates/stores secret key locally, encrypts embedding, calls `/score`, decrypts returned scores, and computes decision locally.
- Plaintext customer message is never sent to policy server.

Notes:
- Added `policy-server/` FastAPI service with `POST /score` using TenSEAL CKKS encrypted dot-product scoring.
- Policy-server loads only public context (`policy-server/keys/public_context.seal`) and rejects private-context usage (`is_private()` guard).
- Implemented customer-side crypto bridge (`scripts/crypto_bridge.py`) for key generation, embedding encryption, and score decryption.
- Wired Next.js gateway `/api/policy-check` to: Gemini embedding -> CKKS encryption -> policy-server `/score` -> CKKS decryption -> local decision engine.
- Added runtime scripts and Dockerfiles: `customer-app.Dockerfile`, `policy-server/Dockerfile`, `scripts/setup_crypto.sh`.
- Validation completed:
  - `python3.11 -m venv .venv --clear`
  - `pip install -r policy-server/requirements.txt`
  - `PYTHON_BIN=.venv/bin/python bash scripts/setup_crypto.sh`
  - `uvicorn app.main:app --app-dir policy-server --host 0.0.0.0 --port 8001`
  - `npm run dev`
  - `/score` output schema verified as base64 ciphertext strings for `harassment`, `threat`, `sexual`.
  - Public context check: `secret_is_private=True` (customer), `public_is_private=False` (policy-server).

## M3: SaaS Monitor Dashboard UI (Phase 2)
Status: M3 DONE

Files to create/modify:
- `src/app/monitor/page.tsx`
- `src/app/api/monitor/route.ts`
- `src/lib/monitor-store.ts`
- `src/app/page.tsx` (monitor link)

Commands to run:
- `npm run dev`

Acceptance checks:
- Monitor page renders latest policy checks with:
  - `session_id`
  - ciphertext size
  - decrypted category scores + decision
  - labels: `Secret key: NOT PRESENT`, `Plaintext stored: NO`
- UI remains deterministic and simple for demo.

Notes:
- Added monitor API and page:
  - `GET /api/monitor`
  - `/monitor` dashboard UI with required labels and columns.
- Switched monitor storage from in-memory to customer-local file storage (`customer-gateway/monitor/events.json`) for deterministic cross-route visibility.
- Validation completed:
  - `/api/monitor` returns entries with `sessionId`, `ciphertextSizeBytes`, decrypted scores, decision/category/confidence.
  - `/monitor` includes labels:
    - `Secret key: NOT PRESENT`
    - `Plaintext stored: NO`

## M4: Voice Mode Extension using Web Speech API (Phase 3)
Status: M4 DONE

Files to create/modify:
- `src/app/page.tsx`
- `src/lib/types.ts`

Commands to run:
- `npm run dev`

Acceptance checks:
- Voice mode toggle starts/stops Web Speech API transcription.
- Transcript uses the exact same `/api/policy-check` pipeline as text mode.
- On `BLOCK`, voice capture stops and session is terminated.

Notes:
- Added Voice Mode toggle and Start/Stop listening controls in chat UI.
- Implemented Web Speech API transcription pipeline in `src/app/page.tsx`.
- Voice transcript uses the same `/api/policy-check` flow as text.
- On `BLOCK`, session is marked blocked and voice listener is stopped immediately.
- Validation completed:
  - UI renders voice controls and transcript status.
  - Compiled and exercised end-to-end policy calls while voice code is enabled.

## Finalization: README
Status: DONE

Files to create/modify:
- `README.md`

Commands to run:
- `npm run dev`
- `uvicorn policy-server.app.main:app --host 0.0.0.0 --port 8001`

Acceptance checks:
- README includes customer app run instructions.
- README includes policy server run instructions.
- README documents required env vars (`GEMINI_API_KEY`, `POLICY_SERVER_URL`, others if used).
- README includes demo steps for harassment, threat, and sexual misconduct categories.

Notes:
- Added `README.md` with:
  - customer app run instructions
  - policy-server run instructions
  - required environment variables (`GEMINI_API_KEY`, `POLICY_SERVER_URL`, `PYTHON_BIN`, model vars)
  - category demo steps for harassment, threat, sexual misconduct
- Added `.eslintrc.json` to run lint non-interactively.
- Validation completed:
  - `npm run lint` => no warnings/errors
  - `npm run build` => success
  - `python -m compileall policy-server scripts/crypto_bridge.py` => success
