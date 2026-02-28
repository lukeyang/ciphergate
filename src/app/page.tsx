"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import type { ChatReplyResponse, InputMode, PolicyCheckResponse, PolicyTimings } from "@/lib/types";

type ChatItem = {
  id: string;
  role: "user" | "model" | "system";
  text: string;
  decisionLine?: string;
  replyText?: string;
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const AGENT_PROFILES = [
  { id: "yuna", name: "Yuna", avatar: "/avatars/yuna.png" },
  { id: "minji", name: "Minji", avatar: "/avatars/minji.png" },
  { id: "jiwon", name: "Jiwon", avatar: "/avatars/jiwon.png" },
];

export default function HomePage(): JSX.Element {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const autoDispatchArmedRef = useRef<boolean>(true);

  const [sessionId, setSessionId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [blocked, setBlocked] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("Policy core idle");
  const [selectedAgent, setSelectedAgent] = useState<typeof AGENT_PROFILES[0]>(AGENT_PROFILES[0]);
  const [voiceMode, setVoiceMode] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [isPolicySubmitting, setIsPolicySubmitting] = useState<boolean>(false);
  const [isReplyPending, setIsReplyPending] = useState<boolean>(false);
  const [lastPolicyTimings, setLastPolicyTimings] = useState<PolicyTimings | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([
    {
      id: "welcome",
      role: "system",
      text: "CipherGate gateway online. Plaintext remains inside customer boundary.",
    },
  ]);

  useEffect(() => {
    setSessionId(crypto.randomUUID());

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const sendMessage = useCallback(async (rawMessage: string, source: InputMode): Promise<void> => {
    const trimmed = rawMessage.trim();
    if (!sessionId) {
      setStatus("Session is initializing...");
      return;
    }

    if (!trimmed || blocked || isPolicySubmitting) {
      return;
    }

    setIsPolicySubmitting(true);

    if (source === "text") {
      setMessage("");
    }

    setStatus("Securing message: encrypting and running policy check...");
    setChat((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
      },
    ]);

    try {
      const response = await fetch("/api/policy-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed, inputMode: source }),
      });

      if (!response.ok) {
        setStatus("Policy check failed");
        setChat((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: "Policy check failed.",
          },
        ]);
        return;
      }

      const payload = (await response.json()) as PolicyCheckResponse;
      setLastPolicyTimings(payload.policyTimings);
      const decisionLine = `${payload.decision} · ${payload.category ?? "none"} · ${payload.confidence.toFixed(3)}`;
      const policyLatencyLine = formatPolicyLatency(payload.policyTimings);

      if (payload.decision === "BLOCK" || payload.blocked) {
        const replyText = payload.reply ?? "Session blocked by policy.";
        setChat((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: `${decisionLine}\n${replyText}`,
            decisionLine,
            replyText,
          },
        ]);

        setStatus(`${policyLatencyLine} · Session blocked`);
        setBlocked(true);
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsListening(false);
        setVoiceMode(false);
        return;
      }

      const allowToken = payload.allowToken;
      if (!allowToken) {
        setStatus("Policy passed, but chat token is missing.");
        setChat((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: "Policy passed but chat reply could not be started.",
          },
        ]);
        return;
      }

      setStatus(`${policyLatencyLine} · Policy ALLOW, routing to support agent...`);

      setIsPolicySubmitting(false);
      setIsReplyPending(true);

      try {
        const chatResponse = await fetch("/api/chat-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: trimmed,
            allowToken,
            inputMode: source,
          }),
        });

        if (!chatResponse.ok) {
          const reason = await chatResponse.text().catch(() => "chat reply failed");
          setChat((previous) => [
            ...previous,
            {
              id: crypto.randomUUID(),
              role: "system",
              text: `Support channel failed: ${reason}`,
            },
          ]);
          setStatus(`${policyLatencyLine} · Reply generation failed`);
          return;
        }

        const chatPayload = (await chatResponse.json()) as ChatReplyResponse;
        setChat((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "model",
            text: `${decisionLine}\n${chatPayload.reply}`,
            decisionLine,
            replyText: chatPayload.reply,
          },
        ]);
        setStatus(`${policyLatencyLine} · Reply ${chatPayload.chatMs} ms`);
      } finally {
        setIsReplyPending(false);
      }
    } catch {
      setStatus("Policy check failed");
    } finally {
      setIsPolicySubmitting(false);
    }
  }, [blocked, isPolicySubmitting, sessionId]);

  useEffect(() => {
    const trimmed = message.trim();
    if (!trimmed) {
      autoDispatchArmedRef.current = true;
      return;
    }

    const autoReady = endsWithSentenceBoundary(trimmed);
    if (!autoReady) {
      autoDispatchArmedRef.current = true;
      return;
    }

    if (!autoDispatchArmedRef.current || !sessionId || blocked || isPolicySubmitting || isReplyPending) {
      return;
    }

    autoDispatchArmedRef.current = false;
    void sendMessage(trimmed, "text");
  }, [blocked, isPolicySubmitting, isReplyPending, message, sendMessage, sessionId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await sendMessage(message, "text");
  }

  function toggleVoiceMode(): void {
    setVoiceMode((previous) => {
      const next = !previous;
      if (!next) {
        stopListening();
        setVoiceTranscript("");
      }
      return next;
    });
  }

  function startListening(): void {
    if (blocked || isListening || !voiceMode) {
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setStatus("Web Speech API is unavailable in this browser.");
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new Recognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "ko-KR";

      recognitionRef.current.onresult = (event: SpeechRecognitionEventLike) => {
        let interimText = "";
        let finalText = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript?.trim() ?? "";

          if (!transcript) {
            continue;
          }

          if (result.isFinal) {
            finalText += `${transcript} `;
          } else {
            interimText += `${transcript} `;
          }
        }

        if (interimText.trim()) {
          setVoiceTranscript(interimText.trim());
        }

        if (finalText.trim()) {
          const finalized = finalText.trim();
          setVoiceTranscript(finalized);
          void sendMessage(finalized, "voice");
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setStatus(`Voice recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    recognitionRef.current.start();
    setIsListening(true);
    setStatus("Voice mode listening...");
  }

  function stopListening(): void {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }

  return (
    <main className="customer-shell">
      <header className="customer-head">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="brand-text">
            <h1>CipherGate</h1>
            <p>Zero-Knowledge Policy Engine</p>
          </div>
        </div>
        <Link className="nav-pill" href="/monitor">
          Policy Monitor →
        </Link>
      </header>

      <section className="telemetry-grid">
        <article className="telemetry-card">
          <p className="telemetry-label">Session</p>
          <p className="telemetry-value mono">{sessionId ? sessionId.slice(0, 8) + "…" : "init"}</p>
        </article>
        <article className="telemetry-card">
          <p className="telemetry-label">Encryption</p>
          <p className="telemetry-value">
            {lastPolicyTimings ? `Encrypt ${lastPolicyTimings.encryptMs} ms` : "CKKS HE"}
          </p>
          {lastPolicyTimings ? (
            <p className="telemetry-sub mono">HE {lastPolicyTimings.saasScoreMs} ms</p>
          ) : null}
        </article>
        <article className="telemetry-card">
          <p className="telemetry-label">Voice</p>
          <p className="telemetry-value">{voiceMode ? (isListening ? "● Live" : "Standby") : "Off"}</p>
        </article>
        <article className="telemetry-card">
          <p className="telemetry-label">Policy</p>
          <p className={`telemetry-value ${blocked ? "danger-txt" : "safe-txt"}`}>
            {blocked ? "Blocked" : "Active"}
          </p>
        </article>
      </section>

      <section className="customer-panel">
        <div className="chat-log">
          {chat.map((item) => (
            <div
              key={item.id}
              className={`msg ${item.role === "user"
                  ? "msg-user"
                  : item.role === "model"
                    ? "msg-model"
                    : `msg-system${item.text.includes("blocked") || item.text.includes("BLOCK") ? " msg-block" : ""}`
                }`}
            >
              {/* Agent avatar goes before text (left), User avatar goes after text (right) */}
              {item.role === "model" && (
                <img
                  src={selectedAgent.avatar}
                  alt={selectedAgent.name}
                  className="avatar"
                />
              )}

              <div className="msg-content">
                {item.role !== "system" && <p className="msg-role">{item.role === "user" ? "You" : selectedAgent.name}</p>}
                {item.decisionLine ? (
                  <>
                    <span className={`msg-decision ${item.decisionLine.includes("BLOCK") ? "decision-block" : "decision-allow"}`}>
                      {item.decisionLine}
                    </span>
                    <p className="msg-text">{item.replyText}</p>
                  </>
                ) : (
                  <p className="msg-text">{item.text}</p>
                )}
              </div>

              {item.role === "user" && (
                <img
                  src="/avatars/customer.png"
                  alt="Customer"
                  className="avatar"
                />
              )}
            </div>
          ))}
        </div>

        <div className="input-area">
          <form className="command-row" onSubmit={onSubmit}>
            <input
              className="command-input"
              type="text"
              placeholder={blocked ? "Session terminated" : "Type a message…"}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={blocked || isPolicySubmitting || !sessionId}
            />
            <button
              className={`command-btn primary${isPolicySubmitting ? " crypto-phase" : ""}`}
              type="submit"
              disabled={blocked || isPolicySubmitting || !sessionId || message.trim().length === 0}
            >
              {isPolicySubmitting ? "Encrypting/Decrypting…" : "Send"}
            </button>
          </form>
          <div className="controls-row">
            <button
              className={`voice-btn ${voiceMode ? (isListening ? "listening" : "active") : ""}`}
              type="button"
              disabled={blocked || !sessionId}
              onClick={voiceMode && isListening ? stopListening : voiceMode ? startListening : toggleVoiceMode}
            >
              {isListening ? "■ Stop" : voiceMode ? "● Listen" : "🎙 Voice"}
            </button>
            {voiceMode && !isListening && (
              <button className="voice-btn" type="button" onClick={toggleVoiceMode} disabled={blocked}>
                ✕ Off
              </button>
            )}
            {voiceMode && voiceTranscript ? (
              <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginLeft: "0.3rem" }}>
                {voiceTranscript}
              </span>
            ) : null}
          </div>
        </div>

        <div className="status-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span className={`status-dot ${blocked ? "blocked" : isPolicySubmitting || isReplyPending ? "processing" : "online"}`} />
            <p className="status-text">{status}</p>
          </div>
          <p className="status-text" style={{ color: "var(--text-tertiary)" }}>
            Plaintext: client-side only
          </p>
          <div className="agent-selector-wrapper">
            <label htmlFor="agent-select">Support Agent:</label>
            <select
              id="agent-select"
              className="agent-selector"
              value={selectedAgent.id}
              onChange={(e) => {
                const agent = AGENT_PROFILES.find((a) => a.id === e.target.value);
                if (agent) setSelectedAgent(agent);
              }}
              disabled={blocked}
            >
              {AGENT_PROFILES.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {blocked && (
        <div className="alert-banner">
          Session terminated — policy threshold exceeded. Refresh to start a new session.
        </div>
      )}
    </main>
  );
}

function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?。！？…]$/.test(text.trim());
}

function formatPolicyLatency(timings: PolicyTimings): string {
  return `Encryption ${timings.encryptMs} ms · HE score ${timings.saasScoreMs} ms · Policy total ${timings.totalPolicyMs} ms`;
}
