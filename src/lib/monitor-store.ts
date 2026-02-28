import fs from "node:fs";
import path from "node:path";

import { PolicyCategory, PolicyDecision, PolicyScores } from "./types";

export type MonitorEntry = {
  id: string;
  sessionId: string;
  ciphertextSizeBytes: number;
  processingMs?: number;
  scores: PolicyScores;
  decision: PolicyDecision;
  category: PolicyCategory | null;
  confidence: number;
  createdAt: string;
};

const MONITOR_DIR = path.join(process.cwd(), "customer-gateway", "monitor");
const MONITOR_FILE = path.join(MONITOR_DIR, "events.json");

export function addMonitorEntry(entry: Omit<MonitorEntry, "id" | "createdAt">): void {
  const current = readEntries();
  const next = [
    {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    },
    ...current,
  ].slice(0, 200);

  ensureStorageReady();
  fs.writeFileSync(MONITOR_FILE, JSON.stringify(next, null, 2), "utf8");
}

export function listMonitorEntries(): MonitorEntry[] {
  return readEntries();
}

function ensureStorageReady(): void {
  if (!fs.existsSync(MONITOR_DIR)) {
    fs.mkdirSync(MONITOR_DIR, { recursive: true });
  }

  if (!fs.existsSync(MONITOR_FILE)) {
    fs.writeFileSync(MONITOR_FILE, "[]", "utf8");
  }
}

function readEntries(): MonitorEntry[] {
  ensureStorageReady();

  try {
    const raw = fs.readFileSync(MONITOR_FILE, "utf8");
    const parsed = JSON.parse(raw) as MonitorEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
