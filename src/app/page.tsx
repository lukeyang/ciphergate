"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { InputMode, PolicyCheckResponse } from "@/lib/types";

type ChatItem = {
  id: string;
  role: "user" | "model" | "system";
  text: string;
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

export default function HomePage(): JSX.Element {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [sessionId, setSessionId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [blocked, setBlocked] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("Ready");
  const [voiceMode, setVoiceMode] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [chat, setChat] = useState<ChatItem[]>([
    {
      id: "welcome",
      role: "system",
      text: "CipherGate initialized. Plaintext remains inside the customer gateway.",
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

  async function sendMessage(rawMessage: string, source: InputMode): Promise<void> {
    const trimmed = rawMessage.trim();
    if (!sessionId) {
      setStatus("Session is initializing...");
      return;
    }

    if (!trimmed || blocked || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    if (source === "text") {
      setMessage("");
    }

    setStatus("Evaluating policy...");
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
        body: JSON.stringify({ sessionId, message: trimmed }),
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
      const decisionText = `Decision=${payload.decision} | category=${payload.category ?? "none"} | confidence=${payload.confidence.toFixed(3)}`;
      const replyText = payload.reply ?? "No response generated.";

      setChat((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: payload.decision === "BLOCK" ? "system" : "model",
          text: `${decisionText}\n${replyText}`,
        },
      ]);

      setStatus(
        `Scores: harassment=${payload.scores.harassment.toFixed(3)}, threat=${payload.scores.threat.toFixed(3)}, sexual=${payload.scores.sexual.toFixed(3)}`
      );

      if (payload.blocked) {
        setBlocked(true);
        stopListening();
        setVoiceMode(false);
      }
    } catch {
      setStatus("Policy check failed");
    } finally {
      setIsSubmitting(false);
    }
  }

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
          setMessage(finalized);
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
    <main>
      <h1>CipherGate Text + Voice MVP</h1>
      <p>
        <Link href="/monitor">Open Monitor Dashboard</Link>
      </p>
      <p>
        Session ID: <code>{sessionId || "initializing..."}</code>
      </p>

      <div className="panel">
        <div className="chat-log">
          {chat.map((item) => (
            <div
              key={item.id}
              className={`msg ${
                item.role === "user" ? "msg-user" : item.role === "model" ? "msg-model" : "msg-system"
              }`}
            >
              {item.text}
            </div>
          ))}
        </div>

        <form className="form-row" onSubmit={onSubmit}>
          <input
            type="text"
            placeholder={blocked ? "Session blocked" : "Type a customer message..."}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={blocked || isSubmitting || !sessionId}
          />
          <button type="submit" disabled={blocked || isSubmitting || !sessionId || message.trim().length === 0}>
            Send
          </button>
        </form>

        <div className="form-row" style={{ marginTop: "0.5rem" }}>
          <button type="button" disabled={blocked || !sessionId} onClick={toggleVoiceMode}>
            {voiceMode ? "Voice Mode: ON" : "Voice Mode: OFF"}
          </button>
          <button
            type="button"
            disabled={!voiceMode || blocked || !sessionId}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? "Stop Listening" : "Start Listening"}
          </button>
        </div>

        {voiceMode ? <div className="status">Voice transcript: {voiceTranscript || "(listening...)"}</div> : null}
        <div className="status">{status}</div>
        {blocked ? <div className="blocked">Session terminated: policy threshold exceeded.</div> : null}
      </div>
    </main>
  );
}
