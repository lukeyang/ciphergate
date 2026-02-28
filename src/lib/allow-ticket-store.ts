import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type AllowTicket = {
  token: string;
  sessionId: string;
  messageDigest: string;
  expiresAt: number;
};

const TICKET_TTL_MS = 2 * 60 * 1000;
const STORE_DIR = path.join(process.cwd(), "customer-gateway", "runtime");
const STORE_FILE = path.join(STORE_DIR, "allow-tickets.json");

export function issueAllowTicket(sessionId: string, message: string): string {
  const tickets = readTickets();
  const now = Date.now();
  const token = randomUUID();
  const nextTickets = cleanupExpiredTickets(tickets, now);

  nextTickets.push({
    token,
    sessionId,
    messageDigest: hashMessage(message),
    expiresAt: now + TICKET_TTL_MS,
  });

  writeTickets(nextTickets);
  return token;
}

export function consumeAllowTicket(sessionId: string, message: string, token: string): boolean {
  const now = Date.now();
  const tickets = cleanupExpiredTickets(readTickets(), now);
  const found = tickets.find((ticket) => ticket.token === token);

  // One-time token: remove even on mismatch to prevent replay probing.
  const remaining = tickets.filter((ticket) => ticket.token !== token);
  writeTickets(remaining);

  if (!found) {
    return false;
  }

  if (found.sessionId !== sessionId) {
    return false;
  }

  if (found.messageDigest !== hashMessage(message)) {
    return false;
  }

  if (found.expiresAt < now) {
    return false;
  }

  return true;
}

function hashMessage(message: string): string {
  return createHash("sha256").update(message).digest("hex");
}

function ensureStorageReady(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, "[]", "utf8");
  }
}

function readTickets(): AllowTicket[] {
  ensureStorageReady();

  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as AllowTicket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTickets(tickets: AllowTicket[]): void {
  ensureStorageReady();
  fs.writeFileSync(STORE_FILE, JSON.stringify(tickets, null, 2), "utf8");
}

function cleanupExpiredTickets(tickets: AllowTicket[], now: number): AllowTicket[] {
  return tickets.filter((ticket) => ticket.expiresAt >= now);
}
