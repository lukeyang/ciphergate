import path from "node:path";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

import { clamp01 } from "./math-utils";
import { PolicyScores } from "./types";

export type EncryptedPolicyScores = {
  harassment: string;
  threat: string;
  sexual: string;
};

type EncryptOutput = {
  ciphertext_embedding: string;
  vector_size: number;
};

const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const CRYPTO_SCRIPT_PATH = path.join(process.cwd(), "scripts", "crypto_bridge.py");
const SECRET_CONTEXT_PATH = path.join(process.cwd(), "customer-gateway", "keys", "secret_context.seal");
const PUBLIC_CONTEXT_PATH = path.join(process.cwd(), "customer-gateway", "keys", "public_context.seal");
const POLICY_PUBLIC_CONTEXT_PATH = path.join(process.cwd(), "policy-server", "keys", "public_context.seal");

let initPromise: Promise<void> | null = null;

export async function ensureCryptoInitialized(): Promise<void> {
  const ready = await hasKeyMaterials();
  if (ready) {
    return;
  }

  if (!initPromise) {
    initPromise = runPython(
      [
        "init",
        "--secret-path",
        SECRET_CONTEXT_PATH,
        "--public-path",
        PUBLIC_CONTEXT_PATH,
        "--policy-public-path",
        POLICY_PUBLIC_CONTEXT_PATH,
      ],
      null
    )
      .then(() => undefined)
      .catch((error) => {
        // Reset so the next call can retry instead of being stuck on a rejected promise
        initPromise = null;
        throw error;
      });
  }

  await initPromise;
}

export async function encryptEmbeddingVector(vector: number[]): Promise<{ ciphertextEmbedding: string; vectorSize: number }> {
  if (vector.length === 0) {
    throw new Error("Embedding vector must not be empty");
  }

  const raw = await runPython(["encrypt", "--secret-path", SECRET_CONTEXT_PATH], { vector });
  const parsed = parseJson<EncryptOutput>(raw);

  return {
    ciphertextEmbedding: parsed.ciphertext_embedding,
    vectorSize: parsed.vector_size,
  };
}

export async function decryptEncryptedScores(encrypted: EncryptedPolicyScores): Promise<PolicyScores> {
  const raw = await runPython(["decrypt", "--secret-path", SECRET_CONTEXT_PATH], {
    scores: encrypted,
  });

  const parsed = parseJson<PolicyScores>(raw);

  return {
    harassment: clamp01(parsed.harassment),
    threat: clamp01(parsed.threat),
    sexual: clamp01(parsed.sexual),
  };
}

async function hasKeyMaterials(): Promise<boolean> {
  return (
    (await fileExists(SECRET_CONTEXT_PATH)) &&
    (await fileExists(PUBLIC_CONTEXT_PATH)) &&
    (await fileExists(POLICY_PUBLIC_CONTEXT_PATH))
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function runPython(args: string[], stdinPayload: Record<string, unknown> | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [CRYPTO_SCRIPT_PATH, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`crypto bridge exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
    });

    if (stdinPayload) {
      child.stdin.write(JSON.stringify(stdinPayload));
    }
    child.stdin.end();
  });
}
