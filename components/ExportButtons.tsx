"use client";

import { useState } from "react";

const DATASETS = [
  { id: "chat_messages", label: "Czat + czasy" },
  { id: "ingest_jobs", label: "Wsady" },
  { id: "collection_snapshots", label: "Migawki zasobu" },
] as const;

/**
 * Eksport pomiarów do CSV.
 *
 * Pobieramy przez fetch + blob, a nie przez zwykłą nawigację do endpointu:
 * dzięki temu błąd (np. brak konfiguracji Sheets) pokazuje się jako komunikat
 * w interfejsie, zamiast wylądować w pobranym pliku .csv z treścią JSON-a.
 * Jedno żądanie na pobranie — nawigacja z sondą HEAD odpytywałaby Sheets dwa razy.
 */
export default function ExportButtons() {
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (dataset: string, label: string) => {
    setError(undefined);
    setBusy(dataset);
    try {
      const res = await fetch(`/api/export?dataset=${dataset}`, { cache: "no-store" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Eksport nieudany (${res.status})`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `${dataset}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Błąd pobierania: ${label}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">Eksport CSV</p>
      <div className="flex flex-wrap gap-2">
        {DATASETS.map((d) => (
          <button
            key={d.id}
            onClick={() => void download(d.id, d.label)}
            disabled={busy !== null}
            className="rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted hover:border-muted hover:text-foreground disabled:opacity-40"
          >
            {busy === d.id ? "Pobieram…" : d.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 font-mono text-xs text-warn">{error}</p>}
      <p className="mt-2 font-mono text-[11px] text-muted">
        Separator `;` i BOM UTF-8 — otwiera się dwuklikiem w Excelu. W pandas:{" "}
        <code>sep=&quot;;&quot;</code>
      </p>
    </div>
  );
}
