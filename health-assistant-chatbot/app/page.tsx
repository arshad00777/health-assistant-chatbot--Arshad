"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type Source = { source: string; snippet: string; score: number };
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[]; 
};

const STORAGE_KEY = "wellpoint-chat-history";

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi, I'm Wellpoint. Ask me a general health question — like sleep, hydration, common symptoms, or medication basics — and I'll answer using the clinic's knowledge base and tell you where the information came from.",
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      } catch {
        /* ignore corrupt local storage */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const history = nextMessages
        .filter((m) => m !== WELCOME)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.wordmark}>
          Well<span>point</span>
        </div>
        <a className={styles.adminLink} href="/admin">
          Admin →
        </a>
      </header>

      <div className={styles.disclaimer} role="note">
        <span>⚠</span>
        <span>
          General health information only — not a diagnosis or a substitute for professional
          medical care. In an emergency, contact your local emergency number.
        </span>
      </div>

      <div className={styles.messages} ref={scrollRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.turn} ${m.role === "user" ? styles.turnUser : styles.turnAssistant}`}
          >
            {m.role === "user" ? (
              <div className={styles.bubbleUser}>{m.content}</div>
            ) : (
              <div>
                <div className={styles.bubbleAssistant}>{m.content}</div>
                {m.sources && m.sources.length > 0 ? (
                  <div className={styles.sources}>
                    {m.sources.map((s, j) => (
                      <span key={j} className={styles.sourceChip} title={s.snippet}>
                        {s.source}
                      </span>
                    ))}
                  </div>
                ) : m !== WELCOME ? (
                  <div className={styles.noSources}>
                    No close match found in the knowledge base — general guidance only.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className={`${styles.turn} ${styles.turnAssistant}`}>
            <div className={styles.bubbleAssistant}>
              <div className={styles.typing}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )} 
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          rows={1}
          placeholder="Ask a general health question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button className={styles.sendButton} onClick={sendMessage} disabled={isSending || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
