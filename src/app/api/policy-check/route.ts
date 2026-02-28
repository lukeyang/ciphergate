import { NextRequest, NextResponse } from "next/server";

import { addDebugEntry } from "@/lib/debug-log-store";
import { addMonitorEntry } from "@/lib/monitor-store";
import { evaluatePolicy } from "@/lib/policy";
import { buildPolicyVector } from "@/lib/policy-vector";
import { scoreEncryptedEmbedding } from "@/lib/policy-server";
import { isSessionBlocked, markSessionBlocked } from "@/lib/session-store";
import { chatWithGemini, embedTextWithGemini } from "@/lib/gemini";
import { scoreLocallyWithDebug } from "@/lib/local-policy";
import {
  decryptEncryptedScores,
  encryptEmbeddingVector,
  ensureCryptoInitialized,
} from "@/lib/crypto-bridge";
import { InputMode, PolicyCheckResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse<PolicyCheckResponse | { error: string }>> {
  const policyStartAt = Date.now();
  const body = (await request.json()) as { sessionId?: string; message?: string; inputMode?: InputMode };
  const sessionId = body.sessionId?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  const inputMode: InputMode = body.inputMode === "voice" ? "voice" : "text";

  if (!sessionId || !message) {
    return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
  }

  let ciphertextSizeBytes: number | undefined;
  let localPolicyDebug: ReturnType<typeof scoreLocallyWithDebug>["debug"] | undefined;

  if (isSessionBlocked(sessionId)) {
    const reply = "Session is terminated because policy threshold has already been exceeded.";
    addDebugEntry({
      sessionId,
      inputMode,
      message,
      blockedBeforeCheck: true,
      decision: "BLOCK",
      category: null,
      confidence: 1,
      scores: { harassment: 0, threat: 0, sexual: 0 },
      reply,
      processingMs: Date.now() - policyStartAt,
      chatDiagnostics: ["session_preblocked"],
    });

    return NextResponse.json(
      {
        sessionId,
        decision: "BLOCK",
        category: null,
        confidence: 1,
        scores: { harassment: 0, threat: 0, sexual: 0 },
        blocked: true,
        reply,
      },
      { status: 200 }
    );
  }

  try {
    await ensureCryptoInitialized();

    const embedding = await embedTextWithGemini(message);
    const localScoreOutput = scoreLocallyWithDebug(message, embedding);
    localPolicyDebug = localScoreOutput.debug;
    const policySignals = localScoreOutput.scores;
    const policyVector = buildPolicyVector(embedding, policySignals);

    const encryptedEmbedding = await encryptEmbeddingVector(policyVector);
    ciphertextSizeBytes = Buffer.from(encryptedEmbedding.ciphertextEmbedding, "base64").byteLength;
    const encryptedScores = await scoreEncryptedEmbedding(sessionId, encryptedEmbedding.ciphertextEmbedding);
    const decryptedScores = await decryptEncryptedScores(encryptedScores);

    const result = evaluatePolicy(decryptedScores);
    const processingMs = Date.now() - policyStartAt;

    addMonitorEntry({
      sessionId,
      ciphertextSizeBytes,
      processingMs,
      scores: result.scores,
      decision: result.decision,
      category: result.category,
      confidence: result.confidence,
    });

    if (result.decision === "BLOCK") {
      markSessionBlocked(sessionId);
      const reply = `Session blocked due to ${result.category} policy.`;

      addDebugEntry({
        sessionId,
        inputMode,
        message,
        blockedBeforeCheck: false,
        ciphertextSizeBytes,
        localPolicy: localPolicyDebug,
        scores: result.scores,
        decision: result.decision,
        category: result.category,
        confidence: result.confidence,
        reply,
        processingMs,
        chatDiagnostics: ["chat_skipped_policy_block"],
      });

      return NextResponse.json(
        {
          sessionId,
          decision: "BLOCK",
          category: result.category,
          confidence: result.confidence,
          scores: result.scores,
          blocked: true,
          reply,
        },
        { status: 200 }
      );
    }

    const chatResult = await chatWithGemini(message);

    addDebugEntry({
      sessionId,
      inputMode,
      message,
      blockedBeforeCheck: false,
      ciphertextSizeBytes,
      localPolicy: localPolicyDebug,
      scores: result.scores,
      decision: result.decision,
      category: result.category,
      confidence: result.confidence,
      reply: chatResult.reply,
      processingMs,
      chatDiagnostics: [
        ...chatResult.diagnostics,
        `used_model:${chatResult.usedModel ?? "none"}`,
        `fallback:${chatResult.fallbackUsed ? "yes" : "no"}`,
      ],
    });

    return NextResponse.json(
      {
        sessionId,
        decision: "ALLOW",
        category: result.category,
        confidence: result.confidence,
        scores: result.scores,
        blocked: false,
        reply: chatResult.reply,
      },
      { status: 200 }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown policy-check error";
    addDebugEntry({
      sessionId,
      inputMode,
      message,
      blockedBeforeCheck: false,
      ciphertextSizeBytes,
      localPolicy: localPolicyDebug,
      processingMs: Date.now() - policyStartAt,
      error: reason,
    });
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
