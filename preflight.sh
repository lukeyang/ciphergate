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

PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}}"
REGION="${GCP_REGION:-us-central1}"
AR_REPO="${GCP_ARTIFACT_REPO:-ciphergate}"
POLICY_SERVICE_NAME="${POLICY_SERVICE_NAME:-ciphergate-policy-server}"
CUSTOMER_SERVICE_NAME="${CUSTOMER_SERVICE_NAME:-ciphergate-customer-app}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
GEMINI_SUPPORT_PROMPT_FILE="${GEMINI_SUPPORT_PROMPT_FILE:-prompts/support-agent.system.txt}"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '[PASS] %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '[WARN] %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[FAIL] %s\n' "$1"
}

check_cmd() {
  local cmd="$1"
  if command -v "${cmd}" >/dev/null 2>&1; then
    pass "command found: ${cmd}"
  else
    fail "missing command: ${cmd}"
  fi
}

check_cmd gcloud
check_cmd git
check_cmd curl

if [[ -z "${PROJECT_ID}" ]]; then
  fail "GCP project is not set. Set GCP_PROJECT_ID or run: gcloud config set project <PROJECT_ID>"
else
  pass "project configured: ${PROJECT_ID}"
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1 || true)"
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  fail "no active gcloud account. Run: gcloud auth login"
else
  pass "active gcloud account: ${ACTIVE_ACCOUNT}"
fi

if [[ -n "${PROJECT_ID}" ]]; then
  if gcloud projects describe "${PROJECT_ID}" --format='value(projectId)' >/dev/null 2>&1; then
    pass "project access verified: ${PROJECT_ID}"
  else
    fail "cannot access project: ${PROJECT_ID}"
  fi

  BILLING_ENABLED="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || true)"
  if [[ "${BILLING_ENABLED}" == "True" ]]; then
    pass "billing enabled: ${PROJECT_ID}"
  elif [[ "${BILLING_ENABLED}" == "False" ]]; then
    fail "billing disabled: ${PROJECT_ID}"
  else
    warn "could not verify billing status (permissions or API issue)"
  fi

  ENABLED_SERVICES="$(gcloud services list --enabled --project "${PROJECT_ID}" --format='value(config.name)' 2>/dev/null || true)"
  for required_service in run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com; do
    if printf '%s\n' "${ENABLED_SERVICES}" | grep -qx "${required_service}"; then
      pass "API enabled: ${required_service}"
    else
      warn "API not enabled yet: ${required_service} (deploy.sh will enable)"
    fi
  done

  if gcloud artifacts repositories describe "${AR_REPO}" --project "${PROJECT_ID}" --location "${REGION}" >/dev/null 2>&1; then
    pass "Artifact Registry repository exists: ${AR_REPO} (${REGION})"
  else
    warn "Artifact Registry repository missing: ${AR_REPO} (${REGION}) (deploy.sh will create)"
  fi
fi

if [[ -n "${GEMINI_API_KEY}" ]]; then
  if [[ "${GEMINI_API_KEY}" == "your_gemini_api_key" ]]; then
    fail "GEMINI_API_KEY is placeholder value"
  else
    pass "GEMINI_API_KEY is set"
  fi
else
  fail "GEMINI_API_KEY is not set"
fi

if [[ -f "${GEMINI_SUPPORT_PROMPT_FILE}" ]]; then
  if [[ -s "${GEMINI_SUPPORT_PROMPT_FILE}" ]]; then
    pass "support prompt file exists: ${GEMINI_SUPPORT_PROMPT_FILE}"
  else
    warn "support prompt file is empty: ${GEMINI_SUPPORT_PROMPT_FILE}"
  fi
else
  fail "support prompt file missing: ${GEMINI_SUPPORT_PROMPT_FILE}"
fi

SECRET_PATH="customer-gateway/keys/secret_context.seal"
CUSTOMER_PUBLIC_PATH="customer-gateway/keys/public_context.seal"
POLICY_PUBLIC_PATH="policy-server/keys/public_context.seal"
if [[ -f "${SECRET_PATH}" && -f "${CUSTOMER_PUBLIC_PATH}" && -f "${POLICY_PUBLIC_PATH}" ]]; then
  pass "CKKS key materials present for customer + policy-server"
else
  warn "CKKS key materials missing; deploy.sh will attempt generation via scripts/setup_crypto.sh"
fi

printf '\nSummary: %d PASS, %d WARN, %d FAIL\n' "${PASS_COUNT}" "${WARN_COUNT}" "${FAIL_COUNT}"
printf 'Region=%s, PolicyService=%s, CustomerService=%s\n' "${REGION}" "${POLICY_SERVICE_NAME}" "${CUSTOMER_SERVICE_NAME}"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  exit 1
fi

