import { clamp01, expandSeedProfile } from "./math-utils";
import { loadLocalPolicyTuning } from "./policy-tuning";
import type { PolicyScores } from "./types";

export function scoreLocally(message: string, embedding: number[]): PolicyScores {
  return scoreLocallyWithDebug(message, embedding).scores;
}

export type LocalPolicyDebug = {
  normalizedMessage: string;
  repeatedAbuseBoost: number;
  harassmentCriticalBoost: number;
  threatCriticalBoost: number;
  harassment: CategoryDebug;
  threat: CategoryDebug;
  sexual: CategoryDebug;
};

type CategoryDebug = {
  keyword: number;
  semantic: number;
  combined: number;
  matchCount: number;
  matchedPatterns: string[];
};

export function scoreLocallyWithDebug(message: string, embedding: number[]): { scores: PolicyScores; debug: LocalPolicyDebug } {
  const tuning = loadLocalPolicyTuning();
  const lower = message.toLowerCase();
  const repetitionBoost = repeatedAbuseBoost(
    lower,
    tuning.repetition.minTokenLength,
    tuning.repetition.minCountPerToken,
    tuning.weights.repeatedAbuseBoost
  );

  const harassmentKeyword = scoreCategory(
    lower,
    tuning.patterns.harassment,
    tuning.weights.keyword.harassment,
    repetitionBoost
  );
  const threatKeyword = scoreCategory(
    lower,
    tuning.patterns.threat,
    tuning.weights.keyword.threat,
    repetitionBoost
  );
  const sexualKeyword = scoreCategory(
    lower,
    tuning.patterns.sexual,
    tuning.weights.keyword.sexual,
    repetitionBoost
  );

  const harassmentSemantic = semanticScore(
    embedding,
    tuning.seeds.harassment,
    tuning.semantic.power,
    tuning.semantic.positiveOnly
  );
  const threatSemantic = semanticScore(
    embedding,
    tuning.seeds.threat,
    tuning.semantic.power,
    tuning.semantic.positiveOnly
  );
  const sexualSemantic = semanticScore(
    embedding,
    tuning.seeds.sexual,
    tuning.semantic.power,
    tuning.semantic.positiveOnly
  );
  const harassmentCriticalBoost = hasPatternMatch(lower, tuning.patterns.harassmentCritical)
    ? tuning.weights.harassmentCriticalBoost
    : 0;
  const threatCriticalBoost = hasPatternMatch(lower, tuning.patterns.threatCritical)
    ? tuning.weights.threatCriticalBoost
    : 0;

  const harassmentCombined = combineScores(
    clamp01(harassmentKeyword.score + harassmentCriticalBoost),
    harassmentSemantic,
    tuning.weights.combine.keyword,
    tuning.weights.combine.semantic
  );
  const threatCombined = combineScores(
    clamp01(threatKeyword.score + threatCriticalBoost),
    threatSemantic,
    tuning.weights.combine.keyword,
    tuning.weights.combine.semantic
  );
  const sexualCombined = combineScores(
    sexualKeyword.score,
    sexualSemantic,
    tuning.weights.combine.keyword,
    tuning.weights.combine.semantic
  );

  return {
    scores: {
      harassment: harassmentCombined,
      threat: threatCombined,
      sexual: sexualCombined
    },
    debug: {
      normalizedMessage: lower,
      repeatedAbuseBoost: repetitionBoost,
      harassmentCriticalBoost,
      threatCriticalBoost,
      harassment: {
        keyword: harassmentKeyword.score,
        semantic: harassmentSemantic,
        combined: harassmentCombined,
        matchCount: harassmentKeyword.matchCount,
        matchedPatterns: harassmentKeyword.matchedPatterns
      },
      threat: {
        keyword: threatKeyword.score,
        semantic: threatSemantic,
        combined: threatCombined,
        matchCount: threatKeyword.matchCount,
        matchedPatterns: threatKeyword.matchedPatterns
      },
      sexual: {
        keyword: sexualKeyword.score,
        semantic: sexualSemantic,
        combined: sexualCombined,
        matchCount: sexualKeyword.matchCount,
        matchedPatterns: sexualKeyword.matchedPatterns
      }
    }
  };
}

function scoreCategory(
  text: string,
  patterns: RegExp[],
  weight: number,
  repetitionBoost: number
): {
  score: number;
  matchCount: number;
  matchedPatterns: string[];
} {
  let matches = 0;
  const matchedPatterns: string[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const found = text.match(pattern);
    if (found && found.length > 0) {
      matches += found.length;
      matchedPatterns.push(pattern.source);
    }
  }

  const keywordCurve = 1 - Math.exp(-matches * weight);
  const raw = keywordCurve + repetitionBoost;
  return {
    score: clamp01(raw),
    matchCount: matches,
    matchedPatterns
  };
}

function repeatedAbuseBoost(
  text: string,
  minTokenLength: number,
  minCountPerToken: number,
  boostValue: number
): number {
  const tokens = text.split(/\s+/).filter((token) => token.length >= minTokenLength);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    const current = counts.get(token) ?? 0;
    counts.set(token, current + 1);
  }

  let repeated = 0;
  for (const count of counts.values()) {
    if (count >= minCountPerToken) {
      repeated += 1;
    }
  }

  return repeated > 0 ? boostValue : 0;
}

function semanticScore(embedding: number[], seed: number[], power: number, positiveOnly: boolean): number {
  const profile = expandSeedProfile(seed, embedding.length);
  const similarity = cosineSimilarity(embedding, profile);
  const base = positiveOnly ? Math.max(0, similarity) : (similarity + 1) / 2;
  return clamp01(Math.pow(base, power));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const limit = Math.min(a.length, b.length);
  if (limit === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < limit; i += 1) {
    const av = Number.isFinite(a[i]) ? a[i] : 0;
    const bv = Number.isFinite(b[i]) ? b[i] : 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / Math.sqrt(normA * normB);
}

function combineScores(keyword: number, semantic: number, keywordWeight: number, semanticWeight: number): number {
  const mixed = keywordWeight * keyword + semanticWeight * semantic;
  return clamp01(mixed);
}

function hasPatternMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}
