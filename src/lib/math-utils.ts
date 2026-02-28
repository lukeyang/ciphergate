/**
 * Shared numeric utilities used across policy modules.
 */

/** Clamp a value to [0, 1] and round to 4 decimal places. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(4));
}

/** Clamp an embedding component to [-1, 1] and round to 6 decimal places. */
export function clipEmbedding(value: number): number {
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

/**
 * Expand a short seed vector to `targetDim` by tiling, then L2-normalise.
 * Mirrors the approach used on the SaaS policy-server side.
 */
export function expandSeedProfile(seed: number[], targetDim: number): number[] {
  if (targetDim <= 0) {
    return [];
  }
  if (seed.length === 0) {
    return new Array<number>(targetDim).fill(0);
  }

  const expanded = new Array<number>(targetDim).fill(0);
  for (let i = 0; i < targetDim; i += 1) {
    expanded[i] = seed[i % seed.length];
  }
  const norm = Math.sqrt(expanded.reduce((sum, v) => sum + v * v, 0)) || 1;
  return expanded.map((v) => v / norm);
}
