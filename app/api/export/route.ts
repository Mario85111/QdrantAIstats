import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { toCsv } from "@/lib/csv";
import { listAllChatMessages, listAllCollectionSnapshots, listIngestJobs } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const DATASETS = ["ingest_jobs", "chat_messages", "collection_snapshots"] as const;
export type Dataset = (typeof DATASETS)[number];

function isDataset(value: string): value is Dataset {
  return (DATASETS as readonly string[]).includes(value);
}

/**
 * Eksport pomiarów do CSV.
 *
 * Źródłem jest Google Sheets, nie Qdrant — eksportujemy historię pomiarów,
 * a nie zawartość zasobu wiedzy (od tego jest /api/documents).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get("dataset") ?? "";

  if (!isDataset(dataset)) {
    return NextResponse.json(
      { error: `Nieznany zbiór. Dozwolone: ${DATASETS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!config.sheets.enabled) {
    // Pusty plik bez wyjaśnienia wyglądałby jak "brak danych". To jest inna sytuacja.
    return NextResponse.json(
      { error: "Google Sheets nie jest skonfigurowany — nie ma czego eksportować." },
      { status: 409 }
    );
  }

  let headers: string[] = [];
  let rows: unknown[][] = [];
  let readError: string | undefined;

  if (dataset === "ingest_jobs") {
    const { rows: jobs, error } = await listIngestJobs(100_000);
    readError = error;
    headers = [
      "id",
      "filename",
      "size_bytes",
      "started_at",
      "finished_at",
      "status",
      "error_message",
      "n8n_execution_id",
      "points_before",
      "points_after",
    ];
    rows = jobs.map((j) => [
      j.id,
      j.filename,
      j.sizeBytes,
      j.startedAt,
      j.finishedAt,
      j.status,
      j.errorMessage,
      j.n8nExecutionId,
      j.pointsBefore,
      j.pointsAfter,
    ]);
  } else if (dataset === "chat_messages") {
    const { rows: messages, error } = await listAllChatMessages();
    readError = error;
    headers = [
      "id",
      "conversation_id",
      "role",
      "content",
      "created_at",
      "ttfb_ms",
      "total_ms",
      "error_message",
      "model",
    ];
    rows = messages.map((m) => [
      m.id,
      m.conversationId,
      m.role,
      m.content,
      m.createdAt,
      m.ttfbMs,
      m.totalMs,
      m.errorMessage,
      m.model,
    ]);
  } else {
    const { rows: snapshots, error } = await listAllCollectionSnapshots();
    readError = error;
    headers = ["id", "taken_at", "points_count", "segments_count", "status", "reachable"];
    rows = snapshots.map((s) => [
      s.id,
      s.takenAt,
      s.pointsCount,
      s.segmentsCount,
      s.status,
      s.reachable ? "TRUE" : "FALSE",
    ]);
  }

  if (readError) {
    return NextResponse.json({ error: readError }, { status: 502 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hydrantstats-${dataset}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
