"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatResponse } from "@/app/api/chat/route";
import type { ModelsResponse } from "@/app/api/models/route";
import { formatMs } from "@/lib/format";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "done" | "error";
  ttfbMs?: number;
  totalMs?: number;
  model?: string;
  measurementSaved?: boolean;
  measurementError?: string;
};

/**
 * Czat z agentem RAG — M-3.
 *
 * Model wybierany w panelu jedzie w body requestu do n8n i jest zapisywany
 * razem z pomiarem czasu. Bez tego historia czasów byłaby nieporównywalna:
 * "18 s" nic nie znaczy, jeśli nie wiadomo, który model tyle zajął.
 */
export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const conversationIdRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: ModelsResponse) => {
        if (cancelled) return;
        setModels(data.models);
        setModel(data.defaultModel);
      })
      .catch(() => {
        /* lista modeli jest wygodą, nie warunkiem działania czatu */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question };
    const pendingId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: "assistant", content: "", status: "pending", model },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversationId: conversationIdRef.current || undefined,
          model: model || undefined,
        }),
      });
      const data: ChatResponse = await res.json();
      conversationIdRef.current = data.conversationId;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: data.status === "done" ? data.answer : (data.message ?? "Błąd agenta"),
                status: data.status,
                ttfbMs: data.ttfbMs,
                totalMs: data.totalMs,
                model: data.model,
                measurementSaved: data.measurementSaved,
                measurementError: data.measurementError,
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: err instanceof Error ? err.message : "Błąd sieci", status: "error" }
            : m
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col rounded border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <label htmlFor="chat-model" className="font-mono text-[11px] uppercase tracking-widest text-muted">
          Model
        </label>
        <select
          id="chat-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={busy || models.length === 0}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-muted disabled:opacity-60 md:flex-none"
        >
          {models.length === 0 && <option value="">(lista niedostępna)</option>}
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex max-h-96 min-h-32 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="font-mono text-xs text-muted">Zadaj pytanie do bazy wiedzy.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "self-end text-right" : "self-start"}>
            <div
              className={`inline-block max-w-md rounded px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-surface-raised"
                  : m.status === "error"
                    ? "border border-l-2 border-border border-l-accent"
                    : "border border-border"
              }`}
            >
              {m.status === "pending" ? (
                <span className="font-mono text-xs text-muted">agent pisze…</span>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
            {m.role === "assistant" && m.status && m.status !== "pending" && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                {m.status === "done"
                  ? `${m.model ?? "?"} · ${formatMs(m.totalMs ?? null)} (TTFB ${formatMs(m.ttfbMs ?? null)})`
                  : `błąd · ${m.model ?? "?"}`}
                {m.measurementSaved === false && (
                  <span className="text-warn">
                    {" "}
                    · pomiar niezapisany
                    {m.measurementError ? ` (${m.measurementError})` : ""}
                  </span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Zapytaj bazę wiedzy…"
          disabled={busy}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-muted disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded border border-border-strong px-4 py-2 font-mono text-xs uppercase tracking-widest hover:border-muted disabled:opacity-40"
        >
          Wyślij
        </button>
      </form>
    </div>
  );
}
