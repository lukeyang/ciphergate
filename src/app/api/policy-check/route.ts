import { NextRequest, NextResponse } from "next/server";

import { issueAllowTicket } from "@/lib/allow-ticket-store";
import { addDebugEntry } from "@/lib/debug-log-store";
import { addMonitorEntry } from "@/lib/monitor-store";
import { evaluatePolicy } from "@/lib/policy";
import { buildPolicyVector } from "@/lib/policy-vector";
import { scoreEncryptedEmbedding } from "@/lib/policy-server";
import { isSessionBlocked, markSessionBlocked } from "@/lib/session-store";
import { embedTextWithGemini } from "@/lib/gemini";
import { scoreLocallyWithDebug } from "@/lib/local-policy";
import {
  decryptEncryptedScores,
  encryptEmbeddingVector,
  ensureCryptoInitialized,
} from "@/lib/crypto-bridge";
import { InputMode, PolicyCheckResponse, PolicyTimings } from "@/lib/types";

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
  const policyTimings = emptyPolicyTimings();

  if (isSessionBlocked(sessionId)) {
    const reply = "Session is terminated because policy threshold has already been exceeded.";
    policyTimings.totalPolicyMs = Date.now() - policyStartAt;
    addDebugEntry({
      stage: "policy",
      sessionId,
      inputMode,
      message,
      blockedBeforeCheck: true,
      decision: "BLOCK",
      category: null,
      confidence: 1,
      scores: { harassment: 0, threat: 0, sexual: 0 },
      policyTimings,
      reply,
      processingMs: policyTimings.totalPolicyMs,
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
        allowToken: null,
        policyTimings,
      },
      { status: 200 }
    );
  }

  try {
    let stepStart = Date.now();
    await ensureCryptoInitialized();
    policyTimings.cryptoInitMs = Date.now() - stepStart;

    stepStart = Date.now();
    const embedding = await embedTextWithGemini(message);
    policyTimings.embedMs = Date.now() - stepStart;

    stepStart = Date.now();
    const localScoreOutput = scoreLocallyWithDebug(message, embedding);
    policyTimings.localScoreMs = Date.now() - stepStart;
    localPolicyDebug = localScoreOutput.debug;
    const policySignals = localScoreOutput.scores;
    const policyVector = buildPolicyVector(embedding, policySignals);

    stepStart = Date.now();
    const encryptedEmbedding = await encryptEmbeddingVector(policyVector);
    policyTimings.encryptMs = Date.now() - stepStart;
    ciphertextSizeBytes = Buffer.from(encryptedEmbedding.ciphertextEmbedding, "base64").byteLength;

    stepStart = Date.now();
    const encryptedScores = await scoreEncryptedEmbedding(sessionId, encryptedEmbedding.ciphertextEmbedding);
    policyTimings.saasScoreMs = Date.now() - stepStart;

    stepStart = Date.now();
    const decryptedScores = await decryptEncryptedScores(encryptedScores);
    policyTimings.decryptMs = Date.now() - stepStart;

    stepStart = Date.now();
    const result = evaluatePolicy(decryptedScores);
    policyTimings.evaluateMs = Date.now() - stepStart;
    policyTimings.totalPolicyMs = Date.now() - policyStartAt;

    addMonitorEntry({
      sessionId,
      ciphertextSizeBytes,
      processingMs: policyTimings.totalPolicyMs,
      scores: result.scores,
      decision: result.decision,
      category: result.category,
      confidence: result.confidence,
    });

    if (result.decision === "BLOCK") {
      markSessionBlocked(sessionId);
      const reply = `Session blocked due to ${result.category} policy.`;

      addDebugEntry({
        stage: "policy",
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
        policyTimings,
        reply,
        processingMs: policyTimings.totalPolicyMs,
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
          allowToken: null,
          policyTimings,
        },
        { status: 200 }
      );
    }

    const allowToken = issueAllowTicket(sessionId, message);

    addDebugEntry({
      stage: "policy",
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
      policyTimings,
      reply: null,
      processingMs: policyTimings.totalPolicyMs,
      chatDiagnostics: ["chat_deferred"],
    });

    return NextResponse.json(
      {
        sessionId,
        decision: "ALLOW",
        category: result.category,
        confidence: result.confidence,
        scores: result.scores,
        blocked: false,
        reply: null,
        allowToken,
        policyTimings,
      },
      { status: 200 }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown policy-check error";
    policyTimings.totalPolicyMs = Date.now() - policyStartAt;
    addDebugEntry({
      stage: "policy",
      sessionId,
      inputMode,
      message,
      blockedBeforeCheck: false,
      ciphertextSizeBytes,
      localPolicy: localPolicyDebug,
      policyTimings,
      processingMs: policyTimings.totalPolicyMs,
      error: reason,
    });
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}

function emptyPolicyTimings(): PolicyTimings {
  return {
    cryptoInitMs: 0,
    embedMs: 0,
    localScoreMs: 0,
    encryptMs: 0,
    saasScoreMs: 0,
    decryptMs: 0,
    evaluateMs: 0,
    totalPolicyMs: 0,
  };
}
