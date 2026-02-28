import base64
import os
from pathlib import Path

import tenseal as ts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import ScoreRequest, ScoreResponse
from .profiles import build_profiles
from .security import load_public_context

app = FastAPI(title="CipherGate Policy Server", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PUBLIC_CONTEXT: ts.Context | None = None
DEFAULT_CONTEXT_PATH = str((Path(__file__).resolve().parent.parent / "keys" / "public_context.seal"))


@app.on_event("startup")
def startup() -> None:
    global PUBLIC_CONTEXT
    context_path = os.getenv("CKKS_PUBLIC_CONTEXT_PATH", DEFAULT_CONTEXT_PATH)
    PUBLIC_CONTEXT = load_public_context(context_path)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "secret_key": "NOT PRESENT",
        "plaintext_stored": "NO",
    }


@app.post("/score", response_model=ScoreResponse)
def score(payload: ScoreRequest) -> ScoreResponse:
    if PUBLIC_CONTEXT is None:
        raise HTTPException(status_code=500, detail="public context not initialized")

    try:
        embedding_bytes = base64.b64decode(payload.ciphertext_embedding)
        encrypted_embedding = ts.ckks_vector_from(PUBLIC_CONTEXT, embedding_bytes)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="invalid ciphertext_embedding") from exc

    try:
        profile_vectors = build_profiles(encrypted_embedding.size())
        harassment = encrypted_embedding.dot(profile_vectors.harassment)
        threat = encrypted_embedding.dot(profile_vectors.threat)
        sexual = encrypted_embedding.dot(profile_vectors.sexual)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="encrypted scoring failed") from exc

    return ScoreResponse(
        harassment=base64.b64encode(harassment.serialize()).decode("ascii"),
        threat=base64.b64encode(threat.serialize()).decode("ascii"),
        sexual=base64.b64encode(sexual.serialize()).decode("ascii"),
    )
