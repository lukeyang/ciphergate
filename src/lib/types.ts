export type PolicyCategory = "harassment" | "threat" | "sexual";

export type PolicyScores = {
  harassment: number;
  threat: number;
  sexual: number;
};

export type PolicyDecision = "ALLOW" | "BLOCK";
export type InputMode = "text" | "voice";

export type PolicyTimings = {
  cryptoInitMs: number;
  embedMs: number;
  localScoreMs: number;
  encryptMs: number;
  saasScoreMs: number;
  decryptMs: number;
  evaluateMs: number;
  totalPolicyMs: number;
};

export type PolicyResult = {
  decision: PolicyDecision;
  category: PolicyCategory | null;
  confidence: number;
  scores: PolicyScores;
};

export type PolicyCheckResponse = {
  sessionId: string;
  decision: PolicyDecision;
  category: PolicyCategory | null;
  confidence: number;
  scores: PolicyScores;
  blocked: boolean;
  reply: string | null;
  allowToken: string | null;
  policyTimings: PolicyTimings;
};

export type ChatReplyResponse = {
  sessionId: string;
  reply: string;
  chatMs: number;
};
