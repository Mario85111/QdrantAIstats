import { google } from "googleapis";
import { config } from "./config";

/**
 * Magazyn pomiarów: Google Sheets, wołany BEZPOŚREDNIO z aplikacji.
 *
 * Nie przez n8n — SCOPE.md, sekcja 4: narzędzie mierzy między innymi to, czy n8n
 * odpowiada. Gdyby pomiary szły przez n8n, awaria n8n kasowałaby dane o tej awarii.
 *
 * Błąd zapisu nigdy nie przerywa operacji użytkownika. Zwracamy informację,
 * że pomiar nie został zapisany, i idziemy dalej (sekcja 6, fallback).
 *
 * Zakładki tworzysz ręcznie w skoroszycie — patrz docs/n8n/README.md, sekcja Sheets.
 */

export const SHEET_INGEST_JOBS = "ingest_jobs";
export const SHEET_CONVERSATIONS = "conversations";
export const SHEET_CHAT_MESSAGES = "chat_messages";
export const SHEET_COLLECTION_SNAPSHOTS = "collection_snapshots";

export type IngestJobRow = {
  id: string;
  filename: string;
  sizeBytes: number;
  startedAt: string;
  finishedAt: string;
  status: "done" | "error";
  errorMessage: string;
  n8nExecutionId: string;
  pointsBefore: number | null;
  pointsAfter: number | null;
};

export type ChatMessageRow = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  ttfbMs: number | null;
  totalMs: number | null;
  errorMessage: string;
  /** Model, który odpowiadał. Bez tego pomiar czasu jest nieporównywalny. */
  model: string;
};

export type ConversationRow = {
  id: string;
  startedAt: string;
  title: string;
};

export type CollectionSnapshotRow = {
  id: string;
  takenAt: string;
  pointsCount: number | null;
  segmentsCount: number | null;
  status: string | null;
  reachable: boolean;
};

export type SheetsWriteResult = { written: boolean; error?: string };
export type SheetsReadResult<T> = { rows: T[]; ok: boolean; error?: string };

let cachedClient: ReturnType<typeof google.sheets> | null = null;

async function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.GoogleAuth({
    keyFile: config.sheets.serviceAccountPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/**
 * Timestampy idą z apostrofem wiodącym, żeby Sheets nie przerobił ISO-8601
 * na własny format daty — SCOPE.md, sekcja 5.
 */
function asText(value: string): string {
  return `'${value}`;
}

function stripLeadingApostrophe(value: unknown): string {
  const s = String(value ?? "");
  return s.startsWith("'") ? s.slice(1) : s;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function appendRow(
  sheetName: string,
  values: (string | number)[]
): Promise<SheetsWriteResult> {
  if (!config.sheets.enabled) {
    return { written: false, error: "Google Sheets nie jest skonfigurowany" };
  }
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheets.spreadsheetId!,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
    return { written: true };
  } catch (err) {
    return {
      written: false,
      error: err instanceof Error ? err.message : `Nieznany błąd zapisu do ${sheetName}`,
    };
  }
}

async function readRows(sheetName: string): Promise<SheetsReadResult<string[]>> {
  if (!config.sheets.enabled) {
    return { rows: [], ok: false, error: "Google Sheets nie jest skonfigurowany" };
  }
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheets.spreadsheetId!,
      range: `${sheetName}!A:Z`,
    });
    const values = res.data.values ?? [];
    // Pierwszy wiersz to nagłówki — pomijamy.
    return { rows: values.slice(1) as string[][], ok: true };
  } catch (err) {
    return {
      rows: [],
      ok: false,
      error: err instanceof Error ? err.message : `Nieznany błąd odczytu ${sheetName}`,
    };
  }
}

// --- ingest_jobs ---

export async function appendIngestJob(row: IngestJobRow): Promise<SheetsWriteResult> {
  return appendRow(SHEET_INGEST_JOBS, [
    row.id,
    row.filename,
    row.sizeBytes,
    asText(row.startedAt),
    asText(row.finishedAt),
    row.status,
    row.errorMessage,
    row.n8nExecutionId,
    row.pointsBefore ?? "",
    row.pointsAfter ?? "",
  ]);
}

/** Ostatnie N wsadów, najnowsze pierwsze — M-2. */
export async function listIngestJobs(limit = 50): Promise<SheetsReadResult<IngestJobRow>> {
  const { rows, ok, error } = await readRows(SHEET_INGEST_JOBS);
  const jobs: IngestJobRow[] = rows.map((r) => ({
    id: r[0] ?? "",
    filename: r[1] ?? "",
    sizeBytes: toNumberOrNull(r[2]) ?? 0,
    startedAt: stripLeadingApostrophe(r[3]),
    finishedAt: stripLeadingApostrophe(r[4]),
    status: (r[5] as IngestJobRow["status"]) ?? "error",
    errorMessage: r[6] ?? "",
    n8nExecutionId: r[7] ?? "",
    pointsBefore: toNumberOrNull(r[8]),
    pointsAfter: toNumberOrNull(r[9]),
  }));
  jobs.reverse();
  return { rows: jobs.slice(0, limit), ok, error };
}

// --- conversations ---

export async function appendConversation(row: ConversationRow): Promise<SheetsWriteResult> {
  return appendRow(SHEET_CONVERSATIONS, [row.id, asText(row.startedAt), row.title]);
}

// --- chat_messages ---

export async function appendChatMessage(row: ChatMessageRow): Promise<SheetsWriteResult> {
  return appendRow(SHEET_CHAT_MESSAGES, [
    row.id,
    row.conversationId,
    row.role,
    row.content,
    asText(row.createdAt),
    row.ttfbMs ?? "",
    row.totalMs ?? "",
    row.errorMessage,
    row.model,
  ]);
}

/** Historia jednej rozmowy, w kolejności chronologicznej — do pamięci kontekstu w UI. */
export async function listChatMessages(
  conversationId: string
): Promise<SheetsReadResult<ChatMessageRow>> {
  const { rows, ok, error } = await readRows(SHEET_CHAT_MESSAGES);
  const messages: ChatMessageRow[] = rows
    .filter((r) => r[1] === conversationId)
    .map((r) => ({
      id: r[0] ?? "",
      conversationId: r[1] ?? "",
      role: (r[2] as ChatMessageRow["role"]) ?? "user",
      content: r[3] ?? "",
      createdAt: stripLeadingApostrophe(r[4]),
      ttfbMs: toNumberOrNull(r[5]),
      totalMs: toNumberOrNull(r[6]),
      errorMessage: r[7] ?? "",
      model: r[8] ?? "",
    }));
  return { rows: messages, ok, error };
}

/** Wszystkie wiadomości, chronologicznie — surowiec pod eksport CSV. */
export async function listAllChatMessages(): Promise<SheetsReadResult<ChatMessageRow>> {
  const { rows, ok, error } = await readRows(SHEET_CHAT_MESSAGES);
  const messages: ChatMessageRow[] = rows.map((r) => ({
    id: r[0] ?? "",
    conversationId: r[1] ?? "",
    role: (r[2] as ChatMessageRow["role"]) ?? "user",
    content: r[3] ?? "",
    createdAt: stripLeadingApostrophe(r[4]),
    ttfbMs: toNumberOrNull(r[5]),
    totalMs: toNumberOrNull(r[6]),
    errorMessage: r[7] ?? "",
    model: r[8] ?? "",
  }));
  return { rows: messages, ok, error };
}

/** Wszystkie migawki kolekcji — surowiec pod eksport CSV. */
export async function listAllCollectionSnapshots(): Promise<
  SheetsReadResult<CollectionSnapshotRow>
> {
  const { rows, ok, error } = await readRows(SHEET_COLLECTION_SNAPSHOTS);
  const snapshots: CollectionSnapshotRow[] = rows.map((r) => ({
    id: r[0] ?? "",
    takenAt: stripLeadingApostrophe(r[1]),
    pointsCount: toNumberOrNull(r[2]),
    segmentsCount: toNumberOrNull(r[3]),
    status: r[4] ?? null,
    reachable: r[5] === "TRUE",
  }));
  return { rows: snapshots, ok, error };
}

/** Czasy odpowiedzi asystenta od danego momentu — surowiec pod wykres M-5. */
export async function listAssistantTimings(
  sinceISO: string
): Promise<SheetsReadResult<{ createdAt: string; totalMs: number; model: string }>> {
  const { rows, ok, error } = await readRows(SHEET_CHAT_MESSAGES);
  const points = rows
    .filter((r) => r[2] === "assistant" && toNumberOrNull(r[6]) !== null)
    .map((r) => ({
      createdAt: stripLeadingApostrophe(r[4]),
      totalMs: toNumberOrNull(r[6])!,
      model: r[8] ?? "",
    }))
    .filter((p) => p.createdAt >= sinceISO);
  return { rows: points, ok, error };
}

// --- collection_snapshots ---

export async function appendCollectionSnapshot(
  row: CollectionSnapshotRow
): Promise<SheetsWriteResult> {
  return appendRow(SHEET_COLLECTION_SNAPSHOTS, [
    row.id,
    asText(row.takenAt),
    row.pointsCount ?? "",
    row.segmentsCount ?? "",
    row.status ?? "",
    row.reachable ? "TRUE" : "FALSE",
  ]);
}

/** Migawki rozmiaru zasobu od danego momentu — surowiec pod wykres M-5. */
export async function listCollectionSnapshots(
  sinceISO: string
): Promise<SheetsReadResult<{ takenAt: string; pointsCount: number | null; reachable: boolean }>> {
  const { rows, ok, error } = await readRows(SHEET_COLLECTION_SNAPSHOTS);
  const points = rows
    .map((r) => ({
      takenAt: stripLeadingApostrophe(r[1]),
      pointsCount: toNumberOrNull(r[2]),
      reachable: r[5] === "TRUE",
    }))
    .filter((p) => p.takenAt >= sinceISO);
  return { rows: points, ok, error };
}
