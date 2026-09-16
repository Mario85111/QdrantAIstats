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
 */

export const SHEET_INGEST_JOBS = "ingest_jobs";

export const INGEST_JOBS_HEADERS = [
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
] as const;

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

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: config.sheets.serviceAccountPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * Timestampy idą z apostrofem wiodącym, żeby Sheets nie przerobił ISO-8601
 * na własny format daty — SCOPE.md, sekcja 5.
 */
function asText(value: string): string {
  return `'${value}`;
}

export type SheetsWriteResult = { written: boolean; error?: string };

export async function appendIngestJob(row: IngestJobRow): Promise<SheetsWriteResult> {
  if (!config.sheets.enabled) {
    return { written: false, error: "Google Sheets nie jest skonfigurowany" };
  }

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheets.spreadsheetId!,
      range: `${SHEET_INGEST_JOBS}!A:J`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
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
          ],
        ],
      },
    });
    return { written: true };
  } catch (err) {
    return {
      written: false,
      error: err instanceof Error ? err.message : "Nieznany błąd zapisu do Sheets",
    };
  }
}
