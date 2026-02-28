import { clamp01, expandSeedProfile } from "./math-utils";
import { PolicyScores } from "./types";

const HARASSMENT_PATTERNS = [
  /idiot/gi,
  /stupid/gi,
  /dumb/gi,
  /moron/gi,
  /shut up/gi,
  /f\*?\*?k you/gi,
  /you are useless/gi,
  /바보/gi,
  /멍청/gi,
  /닥쳐/gi,
  /쓸모없/gi,
  /욕[을]? 하/gi,
  /개새|씨발|병신/gi
];

const THREAT_PATTERNS = [
  /i will hurt/gi,
  /i will kill/gi,
  /i[' ]?ll kill/gi,
  /kill you/gi,
  /threaten/gi,
  /i will find you/gi,
  /watch your back/gi,
  /pay for this/gi,
  /retaliate/gi,
  /destroy your company/gi,
  /죽여버리/gi,
  /죽어버리/gi,
  /죽을래/gi,
  /죽고싶/gi,
  /너.*죽/gi,
  /죽여줄/gi,
  /가만 안 둬/gi,
  /해치겠/gi,
  /찾아가서/gi,
  /보복하겠/gi
];

const THREAT_CRITICAL_PATTERNS = [
  /i will kill/gi,
  /i[' ]?ll kill/gi,
  /kill you/gi,
  /i will hurt/gi,
  /죽여버리/gi,
  /죽어버리/gi,
  /죽을래/gi,
  /너.*죽/gi,
  /해치겠/gi
];

const SEXUAL_PATTERNS = [
  /sex/gi,
  /nude/gi,
  /your body/gi,
  /sleep with me/gi,
  /explicit/gi,
  /sexy/gi,
  /sexual/gi,
  /섹시/gi,
  /누드/gi,
  /야한/gi,
  /성희롱/gi,
  /성적/gi,
  /몸매/gi,
  /벗[어]/gi,
  /누드.*보내|보내.*누드/gi,
  /야한.*사진|사진.*야한/gi
];

export function scoreLocally(message: string, embedding: number[]): PolicyScores {
  return scoreLocallyWithDebug(message, embedding).scores;
}

export type LocalPolicyDebug = {
  normalizedMessage: string;
  repeatedAbuseBoost: number;
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
  const lower = message.toLowerCase();
  const repetitionBoost = repeatedAbuseBoost(lower);

  const harassmentKeyword = scoreCategory(lower, HARASSMENT_PATTERNS, 0.9, repetitionBoost);
  const threatKeyword = scoreCategory(lower, THREAT_PATTERNS, 1.1, repetitionBoost);
  const sexualKeyword = scoreCategory(lower, SEXUAL_PATTERNS, 1.05, repetitionBoost);

  const harassmentSemantic = semanticScore(embedding, HARASSMENT_SEED);
  const threatSemantic = semanticScore(embedding, THREAT_SEED);
  const sexualSemantic = semanticScore(embedding, SEXUAL_SEED);
  const threatCriticalBoost = hasPatternMatch(lower, THREAT_CRITICAL_PATTERNS) ? 0.35 : 0;

  const harassmentCombined = combineScores(harassmentKeyword.score, harassmentSemantic);
  const threatCombined = combineScores(clamp01(threatKeyword.score + threatCriticalBoost), threatSemantic);
  const sexualCombined = combineScores(sexualKeyword.score, sexualSemantic);

  return {
    scores: {
      harassment: harassmentCombined,
      threat: threatCombined,
      sexual: sexualCombined
    },
    debug: {
      normalizedMessage: lower,
      repeatedAbuseBoost: repetitionBoost,
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

function scoreCategory(text: string, patterns: RegExp[], weight: number, repetitionBoost: number): {
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

function repeatedAbuseBoost(text: string): number {
  const tokens = text.split(/\s+/).filter((token) => token.length > 2);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    const current = counts.get(token) ?? 0;
    counts.set(token, current + 1);
  }

  let repeated = 0;
  for (const count of counts.values()) {
    if (count >= 3) {
      repeated += 1;
    }
  }

  return repeated > 0 ? 0.2 : 0;
}

function semanticScore(embedding: number[], seed: number[]): number {
  const profile = expandSeedProfile(seed, embedding.length);
  const similarity = cosineSimilarity(embedding, profile);
  const positiveSimilarity = Math.max(0, similarity);
  return clamp01(Math.pow(positiveSimilarity, 0.85));
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

function combineScores(keyword: number, semantic: number): number {
  const mixed = 0.82 * keyword + 0.18 * semantic;
  return clamp01(mixed);
}

function hasPatternMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

// 32-dim seed vectors – expanded at runtime to match the actual embedding dimension
const HARASSMENT_SEED = [
  0.39, 0.31, 0.27, 0.16, 0.10, 0.11, 0.08, 0.26, 0.35, 0.28, 0.22, 0.13, 0.10, 0.09, 0.20, 0.30,
  0.24, 0.18, 0.17, 0.14, 0.16, 0.22, 0.29, 0.25, 0.19, 0.10, 0.08, 0.15, 0.21, 0.27, 0.25, 0.20,
];

const THREAT_SEED = [
  0.11, 0.14, 0.20, 0.34, 0.36, 0.31, 0.28, 0.18, 0.16, 0.13, 0.10, 0.22, 0.26, 0.30, 0.35, 0.38,
  0.33, 0.29, 0.23, 0.19, 0.17, 0.12, 0.09, 0.14, 0.20, 0.24, 0.31, 0.34, 0.30, 0.25, 0.19, 0.16,
];

const SEXUAL_SEED = [
  0.16, 0.18, 0.12, 0.08, 0.11, 0.15, 0.24, 0.33, 0.37, 0.34, 0.29, 0.22, 0.17, 0.13, 0.10, 0.09,
  0.14, 0.20, 0.26, 0.32, 0.36, 0.33, 0.28, 0.21, 0.17, 0.15, 0.18, 0.24, 0.31, 0.35, 0.30, 0.23,
];
