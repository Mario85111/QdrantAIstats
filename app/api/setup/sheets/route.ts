import { NextResponse } from "next/server";
import { google } from "googleapis";
import { config } from "@/lib/config";
import {
  SHEET_CHAT_MESSAGES,
  SHEET_COLLECTION_SNAPSHOTS,
  SHEET_CONVERSATIONS,
  SHEET_INGEST_JOBS,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

/**
 * Nagłówki muszą zgadzać się co do KOLEJNOŚCI z odczytem w lib/sheets.ts,
 * który czyta kolumny po indeksie. Przestawiona kolumna nie wywoła błędu —
 * po cichu przypisze wartości do złych pól. Dlatego zakładki tworzy kod,
 * a nie człowiek przepisujący nazwy ręcznie.
 */
const SCHEMA: Record<string, string[]> = {
  [SHEET_INGEST_JOBS]: [
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
  ],
  [SHEET_CONVERSATIONS]: ["id", "started_at", "title"],
  [SHEET_CHAT_MESSAGES]: [
    "id",
    "conversation_id",
    "role",
    "content",
    "created_at",
    "ttfb_ms",
    "total_ms",
    "error_message",
    "model",
  ],
  [SHEET_COLLECTION_SNAPSHOTS]: [
    "id",
    "taken_at",
    "points_count",
    "segments_count",
    "status",
    "reachable",
  ],
};

export type SetupSheetsResult = {
  ok: boolean;
  created: string[];
  alreadyExisted: string[];
  headersWritten: string[];
  error?: string;
};

/**
 * Zakłada brakujące zakładki i wpisuje nagłówki. Idempotentne:
 * istniejące zakładki zostawia nietknięte i NIE nadpisuje ich danych —
 * nagłówki wpisuje wyłącznie do zakładek, które właśnie utworzył.
 */
export async function POST() {
  if (!config.sheets.enabled) {
    return NextResponse.json<SetupSheetsResult>(
      {
        ok: false,
        created: [],
        alreadyExisted: [],
        headersWritten: [],
        error:
          "Brak GOOGLE_SHEETS_ID lub GOOGLE_SERVICE_ACCOUNT_JSON w .env.local — uzupełnij i uruchom ponownie.",
      },
      { status: 409 }
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.sheets.serviceAccountPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = config.sheets.spreadsheetId!;

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = new Set(
      (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[]
    );

    const missing = Object.keys(SCHEMA).filter((name) => !existing.has(name));

    if (missing.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
        },
      });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: missing.map((title) => ({
            range: `${title}!A1`,
            values: [SCHEMA[title]],
          })),
        },
      });
    }

    return NextResponse.json<SetupSheetsResult>({
      ok: true,
      created: missing,
      alreadyExisted: Object.keys(SCHEMA).filter((name) => existing.has(name)),
      headersWritten: missing,
    });
  } catch (err) {
    return NextResponse.json<SetupSheetsResult>(
      {
        ok: false,
        created: [],
        alreadyExisted: [],
        headersWritten: [],
        error: err instanceof Error ? err.message : "Nieznany błąd konfiguracji arkusza",
      },
      { status: 502 }
    );
  }
}
