import { clamp01, clipEmbedding } from "./math-utils";
import { PolicyScores } from "./types";

/**
 * Gemini text-embedding-004 produces 768-dim vectors.
 * We use the full embedding so no information is lost.
 */
const BASE_DIM = 768;

export function buildPolicyVector(embedding: number[], signals: PolicyScores): number[] {
  const clipped = embedding.slice(0, BASE_DIM).map((value) => clipEmbedding(value));

  while (clipped.length < BASE_DIM) {
    clipped.push(0);
  }

  return [
    ...clipped,
    clamp01(signals.harassment),
    clamp01(signals.threat),
    clamp01(signals.sexual),
  ];
}
