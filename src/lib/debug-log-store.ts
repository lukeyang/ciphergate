import fs from "node:fs";
import path from "node:path";

import type { LocalPolicyDebug } from "./local-policy";
import type { InputMode, PolicyCategory, PolicyDecision, PolicyScores } from "./types";

export type PolicyDebugEntry = {
  id: string;
  createdAt: string;
  sessionId: string;
  inputMode: InputMode;
  message: string;
  blockedBeforeCheck: boolean;
  ciphertextSizeBytes?: number;
  localPolicy?: LocalPolicyDebug;
  scores?: PolicyScores;
  decision?: PolicyDecision;
  category?: PolicyCategory | null;
  confidence?: number;
  reply?: string | null;
  chatDiagnostics?: string[];
  processingMs?: number;
  error?: string;
};

const MONITOR_DIR = path.join(process.cwd(), "customer-gateway", "monitor");
const DEBUG_FILE = path.join(MONITOR_DIR, "debug-events.json");

export function addDebugEntry(entry: Omit<PolicyDebugEntry, "id" | "createdAt">): void {
  const current = readEntries();
  const next = [
    {
      ...entry,
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
