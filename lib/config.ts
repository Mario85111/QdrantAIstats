/**
 * Konfiguracja czytana wyłącznie po stronie serwera.
 * Żadna z tych wartości nie może trafić do kodu klienta — SCOPE.md, sekcja 10.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Brak zmiennej środowiskowej ${name}. Skopiuj .env.example do .env.local i uzupełnij.`
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const config = {
  qdrant: {
    get url() {
      return required("QDRANT_URL").replace(/\/+$/, "");
    },
    get apiKey() {
      return optional("QDRANT_API_KEY");
    },
    get collection() {
      return required("QDRANT_COLLECTION");
    },
  },
  n8n: {
    get ingestWebhookUrl() {
      return required("INGEST_WEBHOOK_URL");
    },
    get chatWebhookUrl() {
      return required("CHAT_WEBHOOK_URL");
    },
  },
  sheets: {
    get spreadsheetId() {
      return optional("GOOGLE_SHEETS_ID");
    },
    get serviceAccountPath() {
      return optional("GOOGLE_SERVICE_ACCOUNT_JSON");
    },
    /** Sheets jest opcjonalny w M0 — brak konfiguracji nie może wywracać wsadu. */
    get enabled() {
      return Boolean(this.spreadsheetId && this.serviceAccountPath);
    },
  },
  /** Limit z SCOPE.md, sekcja 7. */
  maxUploadBytes: 50 * 1024 * 1024,
  /** Timeout wsadu z M-1. Po nim status to `błąd: timeout`, nigdy `w toku`. */
  ingestTimeoutMs: 120_000,
} as const;
