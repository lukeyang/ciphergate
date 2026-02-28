# CipherGate – Codex Project Instructions

## Overview

CipherGate is a Zero-Knowledge Policy Enforcement SaaS for AI-powered customer support systems.

The system detects abusive customer messages and enforces policy without allowing the SaaS provider to access plaintext conversations.

This file defines mandatory constraints and implementation phases for Codex.

---

## Core Objective

Build an MVP system that:

- Detects abusive customer messages.
- Categorizes violations into:
  - Harassment
  - Threat
  - Sexual Misconduct
- Blocks the session if policy threshold is exceeded.
- Calls Gemini for chat responses only when decision is ALLOW.
- Maintains strict zero-knowledge boundaries.

---

## Mandatory Security Constraints

These rules MUST NOT be violated:

1. The SaaS policy server must NOT load, generate, or store the secret key.
2. The SaaS server must NOT decrypt ciphertext under any circumstances.
3. Plaintext must NEVER be stored in the SaaS service.
4. Decryption must occur ONLY in the Customer Gateway.
5. Only encrypted embeddings may be sent to the SaaS policy server.
6. No KMS integration.
7. Scope is limited to MVP + Voice Extension 1.
8. Do not add additional policy categories beyond the three defined.

If any generated code violates these constraints, it is invalid.

---

## Policy Categories (MVP Only)

1. Harassment  
   - Insults  
   - Profanity  
   - Personal attacks  
   - Repeated abusive language  

2. Threat  
   - Physical threats  
   - Retaliation statements  
   - Aggressive intent toward staff or company  

3. Sexual Misconduct  
   - Sexual harassment  
   - Explicit sexual remarks  
   - Inappropriate sexual comments unrelated to support  

---

## System Architecture

### Customer Side (Next.js + TypeScript)

Responsibilities:

- Chat UI
- Voice mode (Web Speech API)
- Customer Gateway API route (`/api/policy-check`)
- Gemini embedding calls
- CKKS encryption using TenSEAL
- Secret key storage
- Decrypt policy scores
- Apply policy decision
- Call Gemini chat API only if ALLOW

### SaaS Policy Server (FastAPI + TenSEAL)

Responsibilities:

- Accept ciphertext embeddings
- Compute encrypted dot-product scores for:
  - harassment_profile
  - threat_profile
  - sexual_profile
- Return encrypted scores
- Never decrypt
- Never access plaintext

---

## Data Flow

1. User enters message in Chat UI.
2. Customer Gateway calls Gemini embedding API.
3. Embedding vector is encrypted with CKKS.
4. Ciphertext is sent to SaaS `/score` endpoint.
5. SaaS computes encrypted scores and returns them.
6. Customer Gateway decrypts scores.
7. Policy engine determines:
   - ALLOW → Call Gemini chat API.
   - BLOCK → Terminate session.
8. No plaintext is ever transmitted to SaaS.

---

## Policy Decision Logic

Thresholds:

- harassment >= 0.75 → BLOCK
- threat >= 0.70 → BLOCK
- sexual >= 0.70 → BLOCK

Decision process:

1. Select category with highest score.
2. If highest score exceeds its threshold:
   - decision = BLOCK
   - return category and confidence
3. Otherwise:
   - decision = ALLOW

---

## Implementation Phases

### Phase 1 – Text Chat MVP

- Initialize Next.js TypeScript project.
- Implement Chat UI.
- Implement `/api/policy-check` route.
- Integrate Gemini embedding API.
- Implement CKKS encryption using TenSEAL.
- Implement FastAPI SaaS scoring server.
- Decrypt scores in Customer Gateway.
- Apply policy decision.
- Integrate Gemini chat response.

### Phase 2 – SaaS Monitor Dashboard

- Create simple monitoring UI for SaaS.
- Display:
  - Session ID
  - Ciphertext received
  - Category scores
  - Decision
  - "Secret key: NOT PRESENT"
  - "Plaintext stored: NO"

### Phase 3 – Voice Extension

- Add Voice Mode toggle.
- Use Web Speech API for speech-to-text.
- Reuse the same policy-check flow.
- Terminate voice session when decision is BLOCK.

---

## Coding Conventions

Frontend:
- TypeScript only.
- No `any` types.
- No plaintext logging to remote services.

Backend:
- Python 3.11.
- FastAPI for SaaS server.
- Use type hints.
- Keep services minimal and focused.

General:
- Follow defined architecture strictly.
- Do not introduce additional infrastructure.
- Keep MVP implementation clean and simple.

---

## Final Reminder

CipherGate is a Zero-Knowledge system.

The SaaS provider must not be able to access or reconstruct customer plaintext conversations under any circumstance.

All generated code must preserve this boundary.
