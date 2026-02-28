import { EncryptedPolicyScores } from "./crypto-bridge";

const POLICY_SERVER_URL = process.env.POLICY_SERVER_URL ?? "http://127.0.0.1:8001";

type ScoreResponseBody = {
  harassment: string;
  threat: string;
  sexual: string;
};

export async function scoreEncryptedEmbedding(
  sessionId: string,
  ciphertextEmbedding: string
): Promise<EncryptedPolicyScores> {
  const response = await fetch(`${POLICY_SERVER_URL}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
      ciphertext_embedding: ciphertextEmbedding,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Policy server score request failed: ${response.status} ${errorText}`);
  }

  const parsed = (await response.json()) as ScoreResponseBody;
  return {
    harassment: parsed.harassment,
    threat: parsed.threat,
    sexual: parsed.sexual,
  };
}
