"use client";

import { useRef, useState } from "react";
import type { ChatResponse } from "@/app/api/chat/route";
import { formatMs } from "@/lib/format";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "done" | "error";
  ttfbMs?: number;
  totalMs?: number;
};

/** Czat z agentem RAG, z pomiarem czasu odpowiedzi widocznym przy każdej wiadomości — M-3. */
export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationIdRef = useRef<string>("");

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question };
    const pendingId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: "assistant", content: "", status: "pending" },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversationId: conversationIdRef.current || undefined }),
      });
      const data: ChatResponse = await res.json();
      conversationIdRef.current = data.conversationId;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: data.status === "done" ? data.answer : data.message ?? "Błąd agenta",
                status: data.status,
                ttfbMs: data.ttfbMs,
                totalMs: data.totalMs,
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
                  ? `czas odpowiedzi: ${formatMs(m.totalMs ?? null)} (TTFB ${formatMs(m.ttfbMs ?? null)})`
                  : "błąd"}
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
