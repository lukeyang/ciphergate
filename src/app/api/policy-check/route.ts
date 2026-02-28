import { NextRequest, NextResponse } from "next/server";

import { addMonitorEntry } from "@/lib/monitor-store";
import { evaluatePolicy } from "@/lib/policy";
import { buildPolicyVector } from "@/lib/policy-vector";
import { scoreEncryptedEmbedding } from "@/lib/policy-server";
import { isSessionBlocked, markSessionBlocked } from "@/lib/session-store";
import { chatWithGemini, embedTextWithGemini } from "@/lib/gemini";
import { scoreLocally } from "@/lib/local-policy";
import {
  decryptEncryptedScores,
  encryptEmbeddingVector,
  ensureCryptoInitialized,
} from "@/lib/crypto-bridge";
import { PolicyCheckResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse<PolicyCheckResponse | { error: string }>> {
  const policyStartAt = Date.now();
  const body = (await request.json()) as { sessionId?: string; message?: string };
  const sessionId = body.sessionId?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!sessionId || !message) {
    return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
  }

  if (isSessionBlocked(sessionId)) {
    return NextResponse.json(
      {
        sessionId,
        decision: "BLOCK",
        category: null,
        confidence: 1,
        scores: { harassment: 0, threat: 0, sexual: 0 },
        blocked: true,
        reply: "Session is terminated because policy threshold has already been exceeded.",
      },
      { status: 200 }
    );
  }

  try {
    await ensureCryptoInitialized();

    const embedding = await embedTextWithGemini(message);
    const policySignals = scoreLocally(message, embedding);
    const policyVector = buildPolicyVector(embedding, policySignals);

    const encryptedEmbedding = await encryptEmbeddingVector(policyVector);
    const encryptedScores = await scoreEncryptedEmbedding(sessionId, encryptedEmbedding.ciphertextEmbedding);
    const decryptedScores = await decryptEncryptedScores(encryptedScores);

    const result = evaluatePolicy(decryptedScores);
    const processingMs = Date.now() - policyStartAt;

    addMonitorEntry({
      sessionId,
      ciphertextSizeBytes: Buffer.from(encryptedEmbedding.ciphertextEmbedding, "base64").byteLength,
      processingMs,
      scores: result.scores,
      decision: result.decision,
      category: result.category,
      confidence: result.confidence,
    });

    if (result.decision === "BLOCK") {
      markSessionBlocked(sessionId);
      return NextResponse.json(
        {
          sessionId,
          decision: "BLOCK",
          category: result.category,
          confidence: result.confidence,
          scores: result.scores,
          blocked: true,
          reply: `Session blocked due to ${result.category} policy.`,
        },
        { status: 200 }
      );
    }

    const reply = await chatWithGemini(message);

    return NextResponse.json(
      {
        sessionId,
        decision: "ALLOW",
        category: result.category,
        confidence: result.confidence,
        scores: result.scores,
        blocked: false,
        reply,
      },
      { status: 200 }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown policy-check error";
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
