"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { PolicyDebugEntry } from "@/lib/debug-log-store";
import type { MonitorEntry } from "@/lib/monitor-store";
import type { getPolicyTuningPaths } from "@/lib/policy-tuning";

type MonitorResponse = {
  entries: MonitorEntry[];
  debugEntries: PolicyDebugEntry[];
  tuning: ReturnType<typeof getPolicyTuningPaths>;
};

function formatCategory(entry: MonitorEntry): string {
  if (entry.decision === "ALLOW") {
    return "-";
  }
  return entry.category ?? "-";
}

export default function MonitorPage(): JSX.Element {
  const [entries, setEntries] = useState<MonitorEntry[]>([]);
  const [debugEntries, setDebugEntries] = useState<PolicyDebugEntry[]>([]);
  const [tuning, setTuning] = useState<ReturnType<typeof getPolicyTuningPaths> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      const response = await fetch("/api/monitor", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as MonitorResponse;
      if (mounted) {
        setEntries(payload.entries);
        setDebugEntries(payload.debugEntries);
        setTuning(payload.tuning);
      }
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const stats = useMemo(() => {
    const total = entries.length;
    const blocked = entries.filter((entry) => entry.decision === "BLOCK").length;
    const allow = total - blocked;
    const blockRate = total === 0 ? 0 : (blocked / total) * 100;
    const totalProcessingMs = entries.reduce((sum, entry) => sum + (entry.processingMs ?? 0), 0);
    const avgProcessingMs = total === 0 ? 0 : totalProcessingMs / total;

    return {
      total,
      blocked,
      allow,
      blockRate: blockRate.toFixed(1),
      avgProcessingMs: avgProcessingMs.toFixed(1),
    };
  }, [entries]);

  const recentDebug = useMemo(() => debugEntries.slice(0, 40), [debugEntries]);

  return (
    <main className="monitor-shell">
      <header className="monitor-head">
        <div>
          <p className="eyebrow amber">Policy Control Surface</p>
          <h1 className="title monitor-title">Policy Monitor</h1>
        </div>
        <Link className="nav-pill warning" href="/">
          ← Gateway
        </Link>
      </header>

      <section className="monitor-stats">
        <article className="monitor-stat-card">
          <p className="telemetry-label">Total Events</p>
          <p className="telemetry-value">{stats.total}</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">Allowed</p>
          <p className="telemetry-value safe-txt">{stats.allow}</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">Blocked</p>
          <p className="telemetry-value danger-txt">{stats.blocked}</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">Block Rate</p>
          <p className="telemetry-value">{stats.blockRate}%</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">Avg Latency</p>
          <p className="telemetry-value">{stats.avgProcessingMs} ms</p>
        </article>
      </section>

      <section className="monitor-panel">
        <div className="monitor-panel-header">
          <p className="monitor-panel-title">Policy Event Log</p>
          <div className="monitor-policy-tags">
            <span className="tag tag-safe">Secret key: NOT PRESENT</span>
            <span className="tag tag-safe">Plaintext stored: NO</span>
            <span className="tag">Preset: {tuning?.policyPreset || "default"}</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="empty-state">No policy events recorded yet. Send a message from the Gateway.</p>
        ) : (
          <div className="monitor-table-wrap">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Ciphertext</th>
                  <th>Harassment</th>
                  <th>Threat</th>
                  <th>Sexual</th>
                  <th>Decision</th>
                  <th>Category</th>
                  <th>Confidence</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{entry.sessionId.slice(0, 8)}…</td>
                    <td>{(entry.ciphertextSizeBytes / 1024).toFixed(1)} KB</td>
                    <td className={`score-cell ${entry.scores.harassment >= 0.75 ? "hot" : ""}`}>
                      {entry.scores.harassment.toFixed(3)}
                    </td>
                    <td className={`score-cell ${entry.scores.threat >= 0.70 ? "hot" : ""}`}>
                      {entry.scores.threat.toFixed(3)}
                    </td>
                    <td className={`score-cell ${entry.scores.sexual >= 0.70 ? "hot" : ""}`}>
                      {entry.scores.sexual.toFixed(3)}
                    </td>
                    <td>
                      <span className={`decision-pill ${entry.decision === "BLOCK" ? "pill-danger" : "pill-safe"}`}>
                        {entry.decision}
                      </span>
                    </td>
                    <td>{formatCategory(entry)}</td>
                    <td className="mono">{entry.confidence.toFixed(3)}</td>
                    <td className="mono">{entry.processingMs ?? 0} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="monitor-panel">
        <div className="monitor-panel-header">
          <p className="monitor-panel-title">Gateway Debug Trace</p>
          <div className="monitor-policy-tags">
            <span className="tag">Local only</span>
            <span className="tag">Plaintext visible (customer boundary)</span>
          </div>
        </div>

        {recentDebug.length === 0 ? (
          <p className="empty-state">No debug traces yet.</p>
        ) : (
          <div className="monitor-table-wrap">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Session</th>
                  <th>Mode</th>
                  <th>Message</th>
                  <th>Risk (H/T/S)</th>
                  <th>Decision</th>
                  <th>Category</th>
                  <th>Latency</th>
                  <th>Diagnostics</th>
                </tr>
              </thead>
              <tbody>
                {recentDebug.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{new Date(entry.createdAt).toLocaleTimeString()}</td>
                    <td className="mono">{entry.sessionId.slice(0, 8)}…</td>
                    <td>{entry.inputMode}</td>
                    <td style={{ maxWidth: "220px", wordBreak: "break-word" }}>{entry.message}</td>
                    <td className="mono">
                      {(entry.scores?.harassment ?? 0).toFixed(3)} / {(entry.scores?.threat ?? 0).toFixed(3)} / {(entry.scores?.sexual ?? 0).toFixed(3)}
                    </td>
                    <td>
                      <span className={`decision-pill ${entry.decision === "BLOCK" ? "pill-danger" : "pill-safe"}`}>
                        {entry.decision ?? "-"}
                      </span>
                    </td>
                    <td>{entry.category ?? "-"}</td>
                    <td className="mono">{entry.processingMs ?? 0} ms</td>
                    <td style={{ maxWidth: "260px", wordBreak: "break-word" }}>
                      {entry.error ? `error: ${entry.error}` : (entry.chatDiagnostics?.join(" | ") ?? "-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
