export type PolicyCategory = "harassment" | "threat" | "sexual";

export type PolicyScores = {
  harassment: number;
  threat: number;
  sexual: number;
};

export type PolicyDecision = "ALLOW" | "BLOCK";
export type InputMode = "text" | "voice";

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
};
