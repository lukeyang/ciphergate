from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    ciphertext_embedding: str = Field(min_length=16)


class ScoreResponse(BaseModel):
    harassment: str
    threat: str
    sexual: str
