import fs from "node:fs";
import path from "node:path";

import type { PolicyCategory } from "./types";

type RegexBucket = {
  harassment: RegExp[];
  threat: RegExp[];
  threatCritical: RegExp[];
  sexual: RegExp[];
};

export type LocalPolicyTuning = {
  patterns: RegexBucket;
  weights: {
    keyword: Record<PolicyCategory, number>;
    combine: {
      keyword: number;
      semantic: number;
    };
    threatCriticalBoost: number;
    repeatedAbuseBoost: number;
  };
  semantic: {
    power: number;
    positiveOnly: boolean;
  };
  repetition: {
    minTokenLength: number;
    minCountPerToken: number;
  };
  seeds: Record<PolicyCategory, number[]>;
};

const POLICY_CONFIG_DIR = resolveConfigPath(process.env.POLICY_CONFIG_DIR, "config/policy");
const POLICY_PRESET = process.env.POLICY_PRESET?.trim() ?? "";
const EFFECTIVE_POLICY_DIR = POLICY_PRESET
  ? path.join(POLICY_CONFIG_DIR, "presets", POLICY_PRESET)
  : POLICY_CONFIG_DIR;

const LOCAL_POLICY_CONFIG_PATH = resolveConfigPath(
  process.env.LOCAL_POLICY_CONFIG_PATH,
  path.join(EFFECTIVE_POLICY_DIR, "local-policy.json")
);
const DECISION_THRESHOLDS_CONFIG_PATH = resolveConfigPath(
  process.env.POLICY_DECISION_CONFIG_PATH,
  path.join(EFFECTIVE_POLICY_DIR, "decision-thresholds.json")
);
const CATEGORY_SEEDS_CONFIG_PATH = resolveConfigPath(
  process.env.POLICY_SEEDS_CONFIG_PATH,
  path.join(EFFECTIVE_POLICY_DIR, "category-seeds.json")
);

function resolveConfigPath(envValue: string | undefined, fallback: string): string {
  if (!envValue || envValue.trim().length === 0) {
    return path.resolve(process.cwd(), fallback);
  }
  return path.resolve(process.cwd(), envValue.trim());
}

function readJsonObject(filePath: string): Record<string, unknown> {
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_read_error";
    throw new Error(`Failed to read policy config file (${filePath}): ${reason}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_parse_error";
    throw new Error(`Invalid JSON in policy config file (${filePath}): ${reason}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Policy config file must contain an object: ${filePath}`);
  }

  return parsed as Record<string, unknown>;
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected object for ${label}`);
  }
  return value as Record<string, unknown>;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected finite number for ${label}`);
  }
  return value;
}

function readPositiveNumber(value: unknown, label: string): number {
  const num = readNumber(value, label);
  if (num <= 0) {
    throw new Error(`Expected positive number for ${label}`);
  }
  return num;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean for ${label}`);
  }
  return value;
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected string array for ${label}`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`Expected non-empty string entries for ${label}`);
    }
    out.push(item);
  }
  return out;
}

function readNumberArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected number array for ${label}`);
  }
  const out: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error(`Expected finite number entries for ${label}`);
    }
    out.push(item);
  }
  if (out.length === 0) {
    throw new Error(`Expected non-empty number array for ${label}`);
  }
  return out;
}

function compilePatterns(patterns: string[], label: string): RegExp[] {
  return patterns.map((source) => {
    try {
      return new RegExp(source, "gi");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_regex_error";
      throw new Error(`Invalid regex source in ${label}: ${source} (${reason})`);
    }
  });
}

export function loadCategorySeeds(): Record<PolicyCategory, number[]> {
  const root = readJsonObject(CATEGORY_SEEDS_CONFIG_PATH);
  return {
    harassment: readNumberArray(root.harassment, "category-seeds.harassment"),
    threat: readNumberArray(root.threat, "category-seeds.threat"),
    sexual: readNumberArray(root.sexual, "category-seeds.sexual"),
  };
}

export function loadDecisionThresholds(): Record<PolicyCategory, number> {
  const root = readJsonObject(DECISION_THRESHOLDS_CONFIG_PATH);
  const thresholds = readObject(root.thresholds, "decision-thresholds.thresholds");

  return {
    harassment: readPositiveNumber(thresholds.harassment, "decision-thresholds.thresholds.harassment"),
    threat: readPositiveNumber(thresholds.threat, "decision-thresholds.thresholds.threat"),
    sexual: readPositiveNumber(thresholds.sexual, "decision-thresholds.thresholds.sexual"),
  };
}

export function loadLocalPolicyTuning(): LocalPolicyTuning {
  const root = readJsonObject(LOCAL_POLICY_CONFIG_PATH);
  const patternsRoot = readObject(root.patterns, "local-policy.patterns");
  const weightsRoot = readObject(root.weights, "local-policy.weights");
  const keywordRoot = readObject(weightsRoot.keyword, "local-policy.weights.keyword");
  const combineRoot = readObject(weightsRoot.combine, "local-policy.weights.combine");
  const semanticRoot = readObject(root.semantic, "local-policy.semantic");
  const repetitionRoot = readObject(root.repetition, "local-policy.repetition");

  const combineKeywordRaw = readPositiveNumber(combineRoot.keyword, "local-policy.weights.combine.keyword");
  const combineSemanticRaw = readPositiveNumber(combineRoot.semantic, "local-policy.weights.combine.semantic");
  const combineSum = combineKeywordRaw + combineSemanticRaw;

  return {
    patterns: {
      harassment: compilePatterns(readStringArray(patternsRoot.harassment, "local-policy.patterns.harassment"), "local-policy.patterns.harassment"),
      threat: compilePatterns(readStringArray(patternsRoot.threat, "local-policy.patterns.threat"), "local-policy.patterns.threat"),
      threatCritical: compilePatterns(
        readStringArray(patternsRoot.threatCritical, "local-policy.patterns.threatCritical"),
        "local-policy.patterns.threatCritical"
      ),
      sexual: compilePatterns(readStringArray(patternsRoot.sexual, "local-policy.patterns.sexual"), "local-policy.patterns.sexual"),
    },
    weights: {
      keyword: {
        harassment: readPositiveNumber(keywordRoot.harassment, "local-policy.weights.keyword.harassment"),
        threat: readPositiveNumber(keywordRoot.threat, "local-policy.weights.keyword.threat"),
        sexual: readPositiveNumber(keywordRoot.sexual, "local-policy.weights.keyword.sexual"),
      },
      combine: {
        keyword: combineKeywordRaw / combineSum,
        semantic: combineSemanticRaw / combineSum,
      },
      threatCriticalBoost: readNumber(weightsRoot.threatCriticalBoost, "local-policy.weights.threatCriticalBoost"),
      repeatedAbuseBoost: readNumber(weightsRoot.repeatedAbuseBoost, "local-policy.weights.repeatedAbuseBoost"),
    },
    semantic: {
      power: readPositiveNumber(semanticRoot.power, "local-policy.semantic.power"),
      positiveOnly: readBoolean(semanticRoot.positiveOnly, "local-policy.semantic.positiveOnly"),
    },
    repetition: {
      minTokenLength: Math.floor(readPositiveNumber(repetitionRoot.minTokenLength, "local-policy.repetition.minTokenLength")),
      minCountPerToken: Math.floor(readPositiveNumber(repetitionRoot.minCountPerToken, "local-policy.repetition.minCountPerToken")),
    },
    seeds: loadCategorySeeds(),
  };
}

export function getPolicyTuningPaths(): {
  policyConfigDir: string;
  policyPreset: string;
  effectivePolicyDir: string;
  localPolicyConfigPath: string;
  decisionThresholdsConfigPath: string;
  categorySeedsConfigPath: string;
} {
  return {
    policyConfigDir: POLICY_CONFIG_DIR,
    policyPreset: POLICY_PRESET,
    effectivePolicyDir: EFFECTIVE_POLICY_DIR,
    localPolicyConfigPath: LOCAL_POLICY_CONFIG_PATH,
    decisionThresholdsConfigPath: DECISION_THRESHOLDS_CONFIG_PATH,
    categorySeedsConfigPath: CATEGORY_SEEDS_CONFIG_PATH,
  };
}
