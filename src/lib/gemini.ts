const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "models/text-embedding-004";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "models/gemini-2.5-pro";

export async function embedTextWithGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackEmbedding(text, 256);
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
    return fallbackEmbedding(text, 256);
  }

  const payload = (await response.json()) as {
    embedding?: {
      values?: number[];
    };
  };

  const values = payload.embedding?.values;
  if (!values || values.length === 0) {
    return fallbackEmbedding(text, 256);
  }

  return values;
}

export async function chatWithGemini(message: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return `Support reply (fallback): I can help with your request. You said: ${message}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${CHAT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: message }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 220
        }
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return "Support reply (fallback): I can help with account, billing, and product questions.";
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() || "Support reply (fallback): I can help with account, billing, and product questions.";
}

function fallbackEmbedding(text: string, size: number): number[] {
  const result = new Array<number>(size).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    result[i % size] += ((code % 31) - 15) / 100;
  }
  return result;
}
