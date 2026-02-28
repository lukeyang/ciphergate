#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

if [[ -f ".env.deploy" ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env.deploy
  set +a
fi

if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env.local
  set +a
fi

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: required command not found: ${cmd}" >&2
    exit 1
  fi
}

require_file() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "ERROR: missing required file: ${file}" >&2
    exit 1
  fi
}

require_cmd gcloud
require_cmd git
require_cmd curl

PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}}"
REGION="${GCP_REGION:-us-central1}"
AR_REPO="${GCP_ARTIFACT_REPO:-ciphergate}"
POLICY_SERVICE_NAME="${POLICY_SERVICE_NAME:-ciphergate-policy-server}"
CUSTOMER_SERVICE_NAME="${CUSTOMER_SERVICE_NAME:-ciphergate-customer-app}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)}"

GEMINI_API_KEY="${GEMINI_API_KEY:-}"
GEMINI_EMBED_MODEL="${GEMINI_EMBED_MODEL:-models/gemini-embedding-001}"
GEMINI_CHAT_MODEL="${GEMINI_CHAT_MODEL:-models/gemini-2.5-flash}"
GEMINI_CHAT_MODEL_FALLBACKS="${GEMINI_CHAT_MODEL_FALLBACKS:-models/gemini-2.5-pro,models/gemini-1.5-flash}"
GEMINI_CHAT_TIMEOUT_MS="${GEMINI_CHAT_TIMEOUT_MS:-7000}"
GEMINI_SUPPORT_PROMPT_FILE="${GEMINI_SUPPORT_PROMPT_FILE:-prompts/support-agent.system.txt}"
POLICY_PRESET="${POLICY_PRESET:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: GCP project is not set. Export GCP_PROJECT_ID or run: gcloud config set project <PROJECT_ID>" >&2
  exit 1
fi

if [[ -z "${GEMINI_API_KEY}" ]]; then
  echo "ERROR: GEMINI_API_KEY is required for customer-app deployment." >&2
  echo "Set it in .env.deploy/.env.local or export GEMINI_API_KEY before running deploy.sh." >&2
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1 || true)"
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  echo "ERROR: no active gcloud account. Run: gcloud auth login" >&2
  exit 1
fi

ensure_crypto_materials() {
  local secret_path="customer-gateway/keys/secret_context.seal"
  local customer_public_path="customer-gateway/keys/public_context.seal"
  local policy_public_path="policy-server/keys/public_context.seal"

  if [[ -f "${secret_path}" && -f "${customer_public_path}" && -f "${policy_public_path}" ]]; then
    echo "[deploy] CKKS key materials found."
    return
  fi

  local py_bin="${PYTHON_BIN:-}"
  if [[ -z "${py_bin}" && -x ".venv/bin/python" ]]; then
    py_bin=".venv/bin/python"
  fi
  if [[ -z "${py_bin}" ]]; then
    py_bin="python3"
  fi

  echo "[deploy] CKKS key materials missing. Generating with PYTHON_BIN=${py_bin} ..."
  if ! PYTHON_BIN="${py_bin}" bash scripts/setup_crypto.sh; then
    echo "ERROR: failed to generate CKKS key materials." >&2
    echo "Install Python deps first, e.g.:" >&2
    echo "  ${py_bin} -m pip install -r policy-server/requirements.txt" >&2
    exit 1
  fi

  require_file "${secret_path}"
  require_file "${customer_public_path}"
  require_file "${policy_public_path}"
}

ensure_crypto_materials

echo "[deploy] project=${PROJECT_ID} region=${REGION} repo=${AR_REPO} tag=${IMAGE_TAG}"

echo "[deploy] Enabling required GCP APIs ..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project "${PROJECT_ID}" >/dev/null

if ! gcloud artifacts repositories describe "${AR_REPO}" \
  --project "${PROJECT_ID}" \
  --location "${REGION}" >/dev/null 2>&1; then
  echo "[deploy] Creating Artifact Registry repository: ${AR_REPO}"
  gcloud artifacts repositories create "${AR_REPO}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" \
    --repository-format=docker \
    --description="CipherGate container images"
else
  echo "[deploy] Artifact Registry repository exists: ${AR_REPO}"
fi

POLICY_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/policy-server:${IMAGE_TAG}"
CUSTOMER_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/customer-app:${IMAGE_TAG}"

echo "[deploy] Building policy-server image ..."
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --config cloudbuild.policy-server.yaml \
  --substitutions "_POLICY_IMAGE=${POLICY_IMAGE}" \
  .

echo "[deploy] Deploying policy-server to Cloud Run ..."
POLICY_ENV_VARS="^@^CKKS_PUBLIC_CONTEXT_PATH=/app/keys/public_context.seal@"
if [[ -n "${POLICY_PRESET}" ]]; then
  POLICY_ENV_VARS="${POLICY_ENV_VARS}POLICY_PRESET=${POLICY_PRESET}@"
fi

gcloud run deploy "${POLICY_SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --image "${POLICY_IMAGE}" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 1Gi \
  --set-env-vars "${POLICY_ENV_VARS}"

POLICY_URL="$(gcloud run services describe "${POLICY_SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')"

if [[ -z "${POLICY_URL}" ]]; then
  echo "ERROR: failed to resolve policy-server URL after deployment." >&2
  exit 1
fi

echo "[deploy] policy-server URL: ${POLICY_URL}"
if ! curl -fsS "${POLICY_URL}/health" >/dev/null; then
  echo "WARNING: policy-server health check failed: ${POLICY_URL}/health" >&2
fi

POLICY_SERVER_URL="${DEPLOY_POLICY_SERVER_URL:-${POLICY_URL}}"
CUSTOMER_ENV_VARS="^@^POLICY_SERVER_URL=${POLICY_SERVER_URL}@GEMINI_API_KEY=${GEMINI_API_KEY}@GEMINI_EMBED_MODEL=${GEMINI_EMBED_MODEL}@GEMINI_CHAT_MODEL=${GEMINI_CHAT_MODEL}@GEMINI_CHAT_MODEL_FALLBACKS=${GEMINI_CHAT_MODEL_FALLBACKS}@GEMINI_CHAT_TIMEOUT_MS=${GEMINI_CHAT_TIMEOUT_MS}@GEMINI_SUPPORT_PROMPT_FILE=${GEMINI_SUPPORT_PROMPT_FILE}@PYTHON_BIN=/opt/venv/bin/python@NODE_ENV=production@"
if [[ -n "${POLICY_PRESET}" ]]; then
  CUSTOMER_ENV_VARS="${CUSTOMER_ENV_VARS}POLICY_PRESET=${POLICY_PRESET}@"
fi

echo "[deploy] Building customer-app image ..."
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --config cloudbuild.customer-app.yaml \
  --substitutions "_CUSTOMER_IMAGE=${CUSTOMER_IMAGE}" \
  .

echo "[deploy] Deploying customer-app to Cloud Run ..."
gcloud run deploy "${CUSTOMER_SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --image "${CUSTOMER_IMAGE}" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 2Gi \
  --set-env-vars "${CUSTOMER_ENV_VARS}"

CUSTOMER_URL="$(gcloud run services describe "${CUSTOMER_SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')"

echo
echo "============================================"
echo "CipherGate Cloud Run deployment completed."
echo "Project:        ${PROJECT_ID}"
echo "Region:         ${REGION}"
echo "Policy server:  ${POLICY_URL}"
echo "Customer app:   ${CUSTOMER_URL}"
echo "Image tag:      ${IMAGE_TAG}"
echo "============================================"
