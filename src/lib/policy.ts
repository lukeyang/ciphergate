import { clamp01 } from "./math-utils";
import { PolicyCategory, PolicyResult, PolicyScores } from "./types";

const THRESHOLDS: Record<PolicyCategory, number> = {
  harassment: 0.75,
  threat: 0.7,
  sexual: 0.7
};

export function evaluatePolicy(scores: PolicyScores): PolicyResult {
  const ordered = [
    { category: "harassment", score: clamp01(scores.harassment) },
    { category: "threat", score: clamp01(scores.threat) },
    { category: "sexual", score: clamp01(scores.sexual) }
  ] satisfies Array<{ category: PolicyCategory; score: number }>;

  ordered.sort((a, b) => b.score - a.score);

  const top = ordered[0];
  const threshold = THRESHOLDS[top.category];

  if (top.score >= threshold) {
    return {
      decision: "BLOCK",
      category: top.category,
      confidence: top.score,
      scores: {
        harassment: clamp01(scores.harassment),
        threat: clamp01(scores.threat),
        sexual: clamp01(scores.sexual)
      }
    };
  }

  return {
    decision: "ALLOW",
    category: top.category,
    confidence: top.score,
    scores: {
      harassment: clamp01(scores.harassment),
      threat: clamp01(scores.threat),
      sexual: clamp01(scores.sexual)
    }
  };
}
