const blockedSessions = new Set<string>();

export function isSessionBlocked(sessionId: string): boolean {
  return blockedSessions.has(sessionId);
}

export function markSessionBlocked(sessionId: string): void {
  blockedSessions.add(sessionId);
}
