import { PolicyScores } from "./types";

const BASE_DIM = 512;

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

function clipEmbedding(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  if (value < -1) {
    return -1;
  }
  return Number(value.toFixed(6));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  if (value < 0) {
    return 0;
  }
  return Number(value.toFixed(4));
}
