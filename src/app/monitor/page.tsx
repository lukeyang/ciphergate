"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MonitorEntry } from "@/lib/monitor-store";

type MonitorResponse = {
  entries: MonitorEntry[];
};

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

  return (
    <main>
      <h1>CipherGate SaaS Monitor Dashboard</h1>
      <p>
        <Link href="/">Back to Chat</Link>
      </p>
      <div className="panel">
        <p>
          <strong>Secret key: NOT PRESENT</strong>
        </p>
        <p>
          <strong>Plaintext stored: NO</strong>
        </p>

        {entries.length === 0 ? (
          <p className="status">No policy events yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">session_id</th>
                  <th align="left">ciphertext bytes</th>
                  <th align="left">harassment</th>
                  <th align="left">threat</th>
                  <th align="left">sexual</th>
                  <th align="left">decision</th>
                  <th align="left">category</th>
                  <th align="left">confidence</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.sessionId}</td>
                    <td>{entry.ciphertextSizeBytes}</td>
                    <td>{entry.scores.harassment.toFixed(3)}</td>
                    <td>{entry.scores.threat.toFixed(3)}</td>
                    <td>{entry.scores.sexual.toFixed(3)}</td>
                    <td>{entry.decision}</td>
                    <td>{entry.category ?? "none"}</td>
                    <td>{entry.confidence.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
