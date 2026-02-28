import { readFile } from "node:fs/promises";
import path from "node:path";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "models/gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "models/gemini-2.5-pro";
const CHAT_MODEL_FALLBACKS = (process.env.GEMINI_CHAT_MODEL_FALLBACKS ?? "models/gemini-2.5-flash,models/gemini-1.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter((model) => model.length > 0);
const CHAT_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_CHAT_TIMEOUT_MS ?? "7000", 10);
const CHAT_TIMEOUT_MS_SAFE = Number.isFinite(CHAT_TIMEOUT_MS) && CHAT_TIMEOUT_MS > 0 ? CHAT_TIMEOUT_MS : 7000;
const SUPPORT_PROMPT_FILE = process.env.GEMINI_SUPPORT_PROMPT_FILE ?? "prompts/support-agent.system.txt";
const DEFAULT_SUPPORT_AGENT_SYSTEM_PROMPT = [
  "You are a customer support agent for GeminiMart, a global online marketplace similar to Amazon or eBay.",
  "Answer as a professional and concise ecommerce support representative.",
  "Focus on order status, returns/refunds, shipping, payments, account access, and product issues.",
  "When useful, offer short next-step instructions customers can follow immediately.",
  "Do not roleplay as unrelated personas or provide off-topic content.",
  "Reply in the same language as the user message when possible.",
].join("\n");

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

export async function chatWithGemini(message: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return `Support reply (fallback): I can help with your request. You said: ${message}`;
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
              maxOutputTokens: 512
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
      const errorMsg = payload.error?.message ?? rawText.slice(0, 180) ?? "unknown_error";
      diagnostics.push(`${model}:${response.status}`);
      console.warn(`[Gemini chat] model=${model} status=${response.status} error=${errorMsg}`);
      continue;
    }

    const text = extractGeminiText(payload);
    if (text) {
      return text;
    }

    const finishReason = payload.candidates?.[0]?.finishReason ?? "unknown";
    diagnostics.push(`${model}:${response.status}/${finishReason}`);
    console.warn(`[Gemini chat] model=${model} status=${response.status} empty_text finishReason=${finishReason}`);
  }

  console.warn(`[Gemini chat] fallback reply used; attempts=${diagnostics.join(" | ") || "none"}`);
  return "Support reply (fallback): I can help with account, billing, and product questions.";
}
