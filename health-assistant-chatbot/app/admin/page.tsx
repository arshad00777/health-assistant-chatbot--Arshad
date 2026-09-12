"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";

type KbInfo = {
  files: string[];
  indexedChunks: number;
  note: string;
};

export default function AdminPage() {
  const [info, setInfo] = useState<KbInfo | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function loadInfo() {
    const res = await fetch("/api/admin/kb");
    const data = await res.json();
    setInfo(data);
  }

  useEffect(() => {
    loadInfo();
  }, []);

  async function submitFaq() {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.message);
      setQuestion("");
      setAnswer("");
      loadInfo();
    } catch (err: any) {
      setResult(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <a className={styles.back} href="/">
        ← Back to chat
      </a>
      <h1 className={styles.title}>Admin</h1>
      <p className={styles.subtitle}>
        Manage the knowledge base the chatbot retrieves from, and see how many chunks are
        currently indexed for search.
      </p>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Knowledge base status</div>
        <div className={styles.statRow}>
          <div>
            <div className={styles.stat}>{info?.indexedChunks ?? "…"}</div>
            <div className={styles.statLabel}>indexed chunks</div>
          </div>
          <div>
            <div className={styles.stat}>{info?.files.length ?? "…"}</div>
            <div className={styles.statLabel}>source files</div>
          </div>
        </div>
        <ul className={styles.fileList}>
          {info?.files.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {info?.note && <div className={styles.note}>{info.note}</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Add a new FAQ</div>
        <label className={styles.field} htmlFor="q">
          Question
        </label>
        <input
          id="q"
          className={styles.textInput}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How much caffeine is safe per day?"
        />
        <label className={styles.field} htmlFor="a">
          Answer
        </label>
        <textarea
          id="a"
          className={styles.textArea}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Write the general-information answer here…"
        />
        <button
          className={styles.submitButton}
          onClick={submitFaq}
          disabled={saving || !question.trim() || !answer.trim()}
        >
          {saving ? "Saving…" : "Save FAQ"}
        </button>
        {result && <div className={styles.result}>{result}</div>}
      </div>
    </div>
  );
}
