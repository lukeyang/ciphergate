import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { LocalPolicyDebug } from "./local-policy";
import { runtimePath } from "./runtime-path";
import type { InputMode, PolicyCategory, PolicyDecision, PolicyScores, PolicyTimings } from "./types";

export type PolicyDebugEntry = {
  id: string;
  createdAt: string;
  stage?: "policy" | "chat";
  sessionId: string;
  inputMode: InputMode;
  message: string;
  messageDigest?: string;
  messageLength?: number;
  blockedBeforeCheck: boolean;
  ciphertextSizeBytes?: number;
  localPolicy?: LocalPolicyDebug;
  scores?: PolicyScores;
  decision?: PolicyDecision;
  category?: PolicyCategory | null;
  confidence?: number;
  policyTimings?: PolicyTimings;
  chatMs?: number;
  reply?: string | null;
  chatDiagnostics?: string[];
  processingMs?: number;
  error?: string;
};

const MONITOR_DIR = runtimePath("monitor");
const DEBUG_FILE = path.join(MONITOR_DIR, "debug-events.json");
const REDACTED_MESSAGE = "[REDACTED]";
type NewDebugEntry = Omit<PolicyDebugEntry, "id" | "createdAt">;

export function addDebugEntry(entry: NewDebugEntry): void {
  const current = readEntries();
  const sanitized = sanitizeNewEntry(entry);
  const next = [
    {
      ...sanitized,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    },
    ...current,
  ].slice(0, 500);

  ensureStorageReady();
  fs.writeFileSync(DEBUG_FILE, JSON.stringify(next, null, 2), "utf8");
}

export function listDebugEntries(): PolicyDebugEntry[] {
  return readEntries();
}

function ensureStorageReady(): void {
  if (!fs.existsSync(MONITOR_DIR)) {
    fs.mkdirSync(MONITOR_DIR, { recursive: true });
  }

  if (!fs.existsSync(DEBUG_FILE)) {
    fs.writeFileSync(DEBUG_FILE, "[]", "utf8");
  }
}

function readEntries(): PolicyDebugEntry[] {
  ensureStorageReady();

  try {
    const raw = fs.readFileSync(DEBUG_FILE, "utf8");
    const parsed = JSON.parse(raw) as PolicyDebugEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const sanitized = parsed.map((entry) => sanitizeStoredEntry(entry));
    // Migrate legacy plaintext logs in place once loaded.
    fs.writeFileSync(DEBUG_FILE, JSON.stringify(sanitized, null, 2), "utf8");
    return sanitized;
  } catch {
    return [];
  }
}

function sanitizeNewEntry(entry: NewDebugEntry): NewDebugEntry {
  const hasRawMessage = Boolean(entry.message && entry.message !== REDACTED_MESSAGE);
  const messageDigest = entry.messageDigest ?? (hasRawMessage ? hashMessage(entry.message) : undefined);
  const messageLength = entry.messageLength ?? (hasRawMessage ? entry.message.length : undefined);

  return {
    ...entry,
    message: REDACTED_MESSAGE,
    messageDigest,
    messageLength,
    localPolicy: sanitizeLocalPolicy(entry.localPolicy),
  };
}

function sanitizeStoredEntry(entry: PolicyDebugEntry): PolicyDebugEntry {
  const hasRawMessage = Boolean(entry.message && entry.message !== REDACTED_MESSAGE);
  const messageDigest = entry.messageDigest ?? (hasRawMessage ? hashMessage(entry.message) : undefined);
  const messageLength = entry.messageLength ?? (hasRawMessage ? entry.message.length : undefined);

  return {
    ...entry,
    message: REDACTED_MESSAGE,
    messageDigest,
    messageLength,
    localPolicy: sanitizeLocalPolicy(entry.localPolicy),
  };
}

function hashMessage(message: string): string {
  return createHash("sha256").update(message).digest("hex");
}

function sanitizeLocalPolicy(localPolicy: LocalPolicyDebug | undefined): LocalPolicyDebug | undefined {
  if (!localPolicy) {
    return undefined;
  }

  return {
    ...localPolicy,
    normalizedMessage: REDACTED_MESSAGE,
  };
}
