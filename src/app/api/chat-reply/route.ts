import { NextRequest, NextResponse } from "next/server";

import { consumeAllowTicket } from "@/lib/allow-ticket-store";
import { addDebugEntry } from "@/lib/debug-log-store";
import { chatWithGemini } from "@/lib/gemini";
import { isSessionBlocked } from "@/lib/session-store";
import type { ChatReplyResponse, InputMode } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse<ChatReplyResponse | { error: string }>> {
  const chatStartAt = Date.now();
  const body = (await request.json()) as {
    sessionId?: string;
    message?: string;
    allowToken?: string;
    inputMode?: InputMode;
  };
  const sessionId = body.sessionId?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  const allowToken = body.allowToken?.trim() ?? "";
  const inputMode: InputMode = body.inputMode === "voice" ? "voice" : "text";

  if (!sessionId || !message || !allowToken) {
    return NextResponse.json({ error: "sessionId, message, and allowToken are required" }, { status: 400 });
  }

  if (isSessionBlocked(sessionId)) {
    return NextResponse.json({ error: "Session is blocked" }, { status: 403 });
  }

  const validAllowTicket = consumeAllowTicket(sessionId, message, allowToken);
  if (!validAllowTicket) {
    return NextResponse.json({ error: "Invalid or expired allow token" }, { status: 403 });
  }

  try {
    const chatResult = await chatWithGemini(message);
    const chatMs = Date.now() - chatStartAt;

    addDebugEntry({
      stage: "chat",
      sessionId,
      inputMode,
      message,
      blockedBeforeCheck: false,
      decision: "ALLOW",
      category: null,
      confidence: 0,
      reply: chatResult.reply,
      chatMs,
      processingMs: chatMs,
      chatDiagnostics: [
        ...chatResult.diagnostics,
        `used_model:${chatResult.usedModel ?? "none"}`,
        `fallback:${chatResult.fallbackUsed ? "yes" : "no"}`,
      ],
    });

    return NextResponse.json(
      {
        sessionId,
        reply: chatResult.reply,
        chatMs,
      },
      { status: 200 }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown chat-reply error";
    addDebugEntry({
      stage: "chat",
      sessionId,
      inputMode,
      message,
      blockedBeforeCheck: false,
      processingMs: Date.now() - chatStartAt,
      error: reason,
    });
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
