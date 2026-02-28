"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MonitorEntry } from "@/lib/monitor-store";

type MonitorResponse = {
  entries: MonitorEntry[];
};

function formatCategory(entry: MonitorEntry): string {
  if (entry.decision === "ALLOW") {
    return "-";
  }
  return entry.category ?? "-";
}

export default function MonitorPage(): JSX.Element {
  const [entries, setEntries] = useState<MonitorEntry[]>([]);

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

  return (
    <main className="monitor-shell">
      <header className="monitor-head">
        <div>
          <p className="eyebrow amber">SaaS Policy Surface</p>
          <h1 className="title monitor-title">CipherGate SOC Monitor</h1>
        </div>
        <Link className="nav-pill warning" href="/">
          Back to Gateway
        </Link>
      </header>

      <section className="monitor-stats">
        <article className="monitor-stat-card">
          <p className="telemetry-label">Total Events</p>
          <p className="telemetry-value">{stats.total}</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">ALLOW</p>
          <p className="telemetry-value safe-txt">{stats.allow}</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">BLOCK</p>
          <p className="telemetry-value danger-txt">{stats.blocked}</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">Block Rate</p>
          <p className="telemetry-value">{stats.blockRate}%</p>
        </article>
        <article className="monitor-stat-card">
          <p className="telemetry-label">Avg Proc. Time</p>
          <p className="telemetry-value">{stats.avgProcessingMs} ms</p>
        </article>
      </section>

      <section className="monitor-panel">
        <div className="monitor-policy-tags">
          <span className="tag">Secret key: NOT PRESENT</span>
          <span className="tag">Plaintext stored: NO</span>
        </div>

        {entries.length === 0 ? (
          <p className="status-line">No policy events yet.</p>
        ) : (
          <div className="monitor-table-wrap">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>session_id</th>
                  <th>ciphertext bytes</th>
                  <th>harassment</th>
                  <th>threat</th>
                  <th>sexual</th>
                  <th>decision</th>
                  <th>category</th>
                  <th>confidence</th>
                  <th>processing ms</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{entry.sessionId}</td>
                    <td>{entry.ciphertextSizeBytes}</td>
                    <td>{entry.scores.harassment.toFixed(3)}</td>
                    <td>{entry.scores.threat.toFixed(3)}</td>
                    <td>{entry.scores.sexual.toFixed(3)}</td>
                    <td>
                      <span className={`decision-pill ${entry.decision === "BLOCK" ? "pill-danger" : "pill-safe"}`}>
                        {entry.decision}
                      </span>
                    </td>
                    <td>{formatCategory(entry)}</td>
                    <td>{entry.confidence.toFixed(3)}</td>
                    <td>{entry.processingMs ?? 0}</td>
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
