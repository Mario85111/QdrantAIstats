import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { getPointsCount } from "@/lib/qdrant";
import { appendIngestJob } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export type IngestResponse = {
  id: string;
  status: "done" | "error";
  /** `unconfirmed` oznacza: n8n powiedziało OK, ale zasób nie urósł (R-2). */
  reason?: "too_large" | "timeout" | "unconfirmed" | "pipeline_error" | "no_file";
  message?: string;
  filename: string;
  pointsBefore: number | null;
  pointsAfter: number | null;
  durationMs: number;
  measurementSaved: boolean;
  measurementError?: string;
};

/**
 * Qdrant aktualizuje `points_count` z pewnym opóźnieniem po upsercie.
 * Dajemy mu trzy próby, zanim uznamy wsad za niepotwierdzony.
 */
async function pointsCountAfterSettling(before: number | null): Promise<number | null> {
  let latest = await getPointsCount();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (before === null || latest === null || latest > before) break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    latest = await getPointsCount();
  }
  return latest;
}

export async function POST(request: Request) {
  const startedAt = new Date();
  const id = randomUUID();

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        id,
        status: "error",
        reason: "no_file",
        message: "Brak pliku w polu `file`",
        filename: "",
        pointsBefore: null,
        pointsAfter: null,
        durationMs: 0,
        measurementSaved: false,
      } satisfies IngestResponse,
      { status: 400 }
    );
  }

  if (file.size > config.maxUploadBytes) {
    return NextResponse.json(
      {
        id,
        status: "error",
        reason: "too_large",
        message: `Plik przekracza limit ${config.maxUploadBytes / 1024 / 1024} MB`,
        filename: file.name,
        pointsBefore: null,
        pointsAfter: null,
        durationMs: 0,
        measurementSaved: false,
      } satisfies IngestResponse,
      { status: 413 }
    );
  }

  const pointsBefore = await getPointsCount();

  let status: "done" | "error" = "error";
  let reason: IngestResponse["reason"];
  let message = "";
  let executionId = "";

  try {
    const upstream = new FormData();
    upstream.append("file", file, file.name);

    const res = await fetch(config.n8n.ingestWebhookUrl, {
      method: "POST",
      body: upstream,
      signal: AbortSignal.timeout(config.ingestTimeoutMs),
    });

    const text = await res.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text.slice(0, 500) };
    }

    executionId = String(payload.execution_id ?? "");

    if (!res.ok || payload.status === "error") {
      status = "error";
      reason = "pipeline_error";
      message = String(payload.message ?? `n8n odpowiedziało ${res.status}`);
    } else {
      status = "done";
    }
  } catch (err) {
    status = "error";
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    reason = isTimeout ? "timeout" : "pipeline_error";
    message = isTimeout
      ? `Brak odpowiedzi n8n w ciągu ${config.ingestTimeoutMs / 1000} s`
      : err instanceof Error
        ? err.message
        : "Nieznany błąd wywołania n8n";
  }

  const pointsAfter = await pointsCountAfterSettling(pointsBefore);

  /**
   * Sedno projektu: status „w zasobie" opiera się na wzroście liczby punktów,
   * nie na kodzie HTTP z n8n. SCOPE.md, ryzyko R-2.
   */
  if (status === "done") {
    const grew = pointsBefore !== null && pointsAfter !== null && pointsAfter > pointsBefore;
    if (!grew) {
      status = "error";
      reason = "unconfirmed";
      message =
        pointsAfter === null
          ? "n8n zgłosiło sukces, ale Qdrant nie odpowiada — nie da się potwierdzić wsadu"
          : "n8n zgłosiło sukces, ale liczba punktów w kolekcji nie wzrosła";
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const measurement = await appendIngestJob({
    id,
    filename: file.name,
    sizeBytes: file.size,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status,
    errorMessage: message,
    n8nExecutionId: executionId,
    pointsBefore,
    pointsAfter,
  });

  return NextResponse.json(
    {
      id,
      status,
      reason,
      message: message || undefined,
      filename: file.name,
      pointsBefore,
      pointsAfter,
      durationMs,
      measurementSaved: measurement.written,
      measurementError: measurement.error,
    } satisfies IngestResponse,
    { status: 200 }
  );
}
