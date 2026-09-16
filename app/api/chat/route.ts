import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { appendChatMessage, appendConversation } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export type ChatResponse = {
  conversationId: string;
  answer: string;
  status: "done" | "error";
  message?: string;
  ttfbMs: number;
  totalMs: number;
  measurementSaved: boolean;
  measurementError?: string;
};

/**
 * Woła webhook czatu w n8n i mierzy czas odpowiedzi po stronie aplikacji.
 *
 * TTFB liczony jest uczciwie z pierwszego odebranego kawałka strumienia
 * odpowiedzi — n8n zwraca JSON w całości (Respond to Webhook nie strumieniuje),
 * więc dla małych odpowiedzi ttfb i total_ms wyjdą praktycznie równe. To nie
 * jest błąd pomiaru — to uczciwy opis tego, jak działa zaplecze.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json(
      { status: "error", message: "Brak pytania", conversationId: "", answer: "", ttfbMs: 0, totalMs: 0, measurementSaved: false } satisfies ChatResponse,
      { status: 400 }
    );
  }

  let conversationId: string = typeof body?.conversationId === "string" ? body.conversationId : "";
  const isNewConversation = !conversationId;
  if (isNewConversation) {
    conversationId = randomUUID();
  }

  const startedAt = Date.now();
  const userMessageId = randomUUID();

  if (isNewConversation) {
    await appendConversation({
      id: conversationId,
      startedAt: new Date(startedAt).toISOString(),
      title: question.slice(0, 80),
    });
  }
  const userMeasurement = await appendChatMessage({
    id: userMessageId,
    conversationId,
    role: "user",
    content: question,
    createdAt: new Date(startedAt).toISOString(),
    ttfbMs: null,
    totalMs: null,
    errorMessage: "",
  });

  let status: "done" | "error" = "error";
  let answer = "";
  let message = "";
  let ttfbMs = 0;

  try {
    const res = await fetch(config.n8n.chatWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, conversation_id: conversationId }),
      signal: AbortSignal.timeout(config.chatTimeoutMs),
    });

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    if (reader) {
      let first = true;
      for (;;) {
        const { done, value } = await reader.read();
        if (first) {
          ttfbMs = Date.now() - startedAt;
          first = false;
        }
        if (done) break;
        if (value) chunks.push(value);
      }
    } else {
      ttfbMs = Date.now() - startedAt;
    }

    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text.slice(0, 500) };
    }

    if (!res.ok || payload.status === "error") {
      status = "error";
      message = String(payload.message ?? `n8n odpowiedziało ${res.status}`);
    } else {
      status = "done";
      answer = String(payload.answer ?? "");
    }
  } catch (err) {
    status = "error";
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    message = isTimeout
      ? `Brak odpowiedzi w ciągu ${config.chatTimeoutMs / 1000} s`
      : err instanceof Error
        ? err.message
        : "Nieznany błąd wywołania n8n";
    ttfbMs = ttfbMs || Date.now() - startedAt;
  }

  const totalMs = Date.now() - startedAt;

  const assistantMeasurement = await appendChatMessage({
    id: randomUUID(),
    conversationId,
    role: "assistant",
    content: status === "done" ? answer : "",
    createdAt: new Date().toISOString(),
    ttfbMs,
    totalMs,
    errorMessage: message,
  });

  return NextResponse.json(
    {
      conversationId,
      answer,
      status,
      message: message || undefined,
      ttfbMs,
      totalMs,
      measurementSaved: userMeasurement.written && assistantMeasurement.written,
      measurementError: assistantMeasurement.error ?? userMeasurement.error,
    } satisfies ChatResponse,
    { status: 200 }
  );
}
