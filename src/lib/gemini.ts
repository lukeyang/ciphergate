import { readFile } from "node:fs/promises";
import path from "node:path";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "models/gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "models/gemini-2.5-flash";
const CHAT_MODEL_FALLBACKS = (process.env.GEMINI_CHAT_MODEL_FALLBACKS ?? "models/gemini-2.5-pro,models/gemini-1.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter((model) => model.length > 0);
const CHAT_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_CHAT_TIMEOUT_MS ?? "7000", 10);
const CHAT_TIMEOUT_MS_SAFE = Number.isFinite(CHAT_TIMEOUT_MS) && CHAT_TIMEOUT_MS > 0 ? CHAT_TIMEOUT_MS : 7000;
const SUPPORT_PROMPT_FILE = process.env.GEMINI_SUPPORT_PROMPT_FILE ?? "prompts/support-agent.system.txt";
const DEFAULT_SUPPORT_AGENT_SYSTEM_PROMPT = [
  "You are a real human customer support representative at GeminiMart, a global online marketplace similar to Amazon or eBay.",
  "Never say you are an AI, chatbot, or automated system. Respond naturally as a friendly, professional human agent would.",
  "Use casual but polite tone, like a real person chatting. For example, say things like \"Let me check that for you\" or \"Sure, I can help with that!\"",
  "Reply in plain text only. Never use markdown, lists, headings, or code blocks.",
  "Keep each answer concise: one or two short sentences.",
  "For refund requests, provide only high-level guidance unless the user explicitly asks for step-by-step details.",
  "Stay on ecommerce support topics only: orders, shipping, payments, account, returns.",
  "Reply in the same language as the user when possible.",
].join("\n");

export type GeminiChatResult = {
  reply: string;
  diagnostics: string[];
  usedModel: string | null;
  fallbackUsed: boolean;
};

let promptCache: string | null = null;
let promptLoading: Promise<string> | null = null;

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  finishReason?: string;
};

type GeminiChatPayload = {
  candidates?: GeminiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function getFinishReason(payload: GeminiChatPayload): string {
  return payload.candidates?.[0]?.finishReason ?? "unknown";
}

function extractGeminiText(payload: GeminiChatPayload): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text?.trim() ?? "")
    .filter((text) => text.length > 0)
    .join("\n")
    .trim();
}

function normalizeModelList(primaryModel: string, fallbackModels: string[]): string[] {
  const models: string[] = [];
  const seen = new Set<string>();
  for (const model of [primaryModel, ...fallbackModels]) {
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    models.push(model);
  }
  return models;
}

function isKoreanText(text: string): boolean {
  return /[가-힣]/.test(text);
}

function fallbackSupportReply(message: string): string {
  if (isKoreanText(message)) {
    return "네, 도와드릴게요! 주문번호나 계정 이메일 알려주시면 바로 확인해볼게요.";
  }
  return "Sure, let me help you with that! Could you share your order number or account email so I can look into it?";
}

function toSingleLinePlainText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/g, "").trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateBySentence(text: string): string {
  const normalized = toSingleLinePlainText(text);
  if (!normalized) {
    return normalized;
  }

  const chunks = normalized.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [normalized];
  const topTwo = chunks.slice(0, 2).join(" ").trim();
  const preferred = topTwo.length > 0 ? topTwo : normalized;
  if (preferred.length <= 220) {
    return preferred;
  }
  return `${preferred.slice(0, 217).trimEnd()}...`;
}

function finalizePlainReply(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (/[.!?。！？]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}

function isLikelyIncompleteReply(reply: string, finishReason: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed) {
    return true;
  }
  if (finishReason === "MAX_TOKENS") {
    return true;
  }
  if (trimmed.length < 14 && !/[.!?。！？]$/.test(trimmed)) {
    return true;
  }
  return false;
}

async function loadSupportAgentSystemPrompt(): Promise<string> {
  if (promptCache) {
    return promptCache;
  }
  if (promptLoading) {
    return promptLoading;
  }

  promptLoading = (async () => {
    const promptPath = path.resolve(process.cwd(), SUPPORT_PROMPT_FILE);
    try {
      const raw = await readFile(promptPath, "utf8");
      const normalized = raw.trim();
      if (!normalized) {
        console.warn(`[Gemini chat] prompt file is empty path=${promptPath}; using default prompt`);
        promptCache = DEFAULT_SUPPORT_AGENT_SYSTEM_PROMPT;
        return promptCache;
      }
      promptCache = normalized;
      return promptCache;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_read_error";
      console.warn(`[Gemini chat] failed to read prompt file path=${promptPath} reason=${reason}; using default prompt`);
      promptCache = DEFAULT_SUPPORT_AGENT_SYSTEM_PROMPT;
      return promptCache;
    } finally {
      promptLoading = null;
    }
  })();

  return promptLoading;
}

export async function embedTextWithGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured – cannot generate embedding");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        content: {
          parts: [{ text }]
        }
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "unknown");
    throw new Error(`Gemini embedding API failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as {
    embedding?: {
      values?: number[];
    };
  };

  const values = payload.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding API returned empty values");
  }

  return values;
}

export async function chatWithGemini(message: string): Promise<GeminiChatResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      reply: fallbackSupportReply(message),
      diagnostics: ["missing_api_key"],
      usedModel: null,
      fallbackUsed: true,
    };
  }

  const modelCandidates = normalizeModelList(CHAT_MODEL, CHAT_MODEL_FALLBACKS);
  const diagnostics: string[] = [];
  const supportSystemPrompt = await loadSupportAgentSystemPrompt();

  for (const model of modelCandidates) {
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: supportSystemPrompt }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: message }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 192
            }
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(CHAT_TIMEOUT_MS_SAFE)
        }
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_fetch_error";
      diagnostics.push(`${model}:request_failed`);
      console.warn(`[Gemini chat] model=${model} request_failed reason=${reason}`);
      continue;
    }

    const rawText = await response.text();
    let payload: GeminiChatPayload = {};
    try {
      payload = rawText ? (JSON.parse(rawText) as GeminiChatPayload) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const errorStatus = payload.error?.status ?? "UNKNOWN";
      const errorMsg = payload.error?.message ?? rawText.slice(0, 180) ?? "unknown_error";
      diagnostics.push(`${model}:http_${response.status}_${errorStatus}`);
      console.warn(`[Gemini chat] model=${model} status=${response.status} error_status=${errorStatus} error=${errorMsg}`);
      continue;
    }

    const finishReason = getFinishReason(payload);
    const text = extractGeminiText(payload);
    if (text) {
      const shortReply = truncateBySentence(text);
      const finalReply = finalizePlainReply(shortReply);
      if (isLikelyIncompleteReply(finalReply, finishReason)) {
        diagnostics.push(`${model}:incomplete_${finishReason}`);
        console.warn(`[Gemini chat] model=${model} incomplete_reply finishReason=${finishReason} reply=${finalReply}`);
        continue;
      }

      return {
        reply: finalReply,
        diagnostics,
        usedModel: model,
        fallbackUsed: false,
      };
    }

    diagnostics.push(`${model}:empty_text_${finishReason}`);
    console.warn(`[Gemini chat] model=${model} status=${response.status} empty_text finishReason=${finishReason}`);
  }

  console.warn(`[Gemini chat] fallback reply used; attempts=${diagnostics.join(" | ") || "none"}`);
  return {
    reply: fallbackSupportReply(message),
    diagnostics: diagnostics.length > 0 ? diagnostics : ["all_models_unavailable"],
    usedModel: null,
    fallbackUsed: true,
  };
}
