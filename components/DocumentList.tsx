"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentSummary } from "@/lib/qdrant";
import type { DocumentsResponse } from "@/app/api/documents/route";
import { formatDateTime, formatNumber } from "@/lib/format";

type Target = { filename: string | null; chunks: number };

/**
 * Lista dokumentów w zasobie + usuwanie pojedynczego dokumentu.
 *
 * Qdrant nie zna pojęcia „dokument" — zna punkty. Grupowanie po
 * `metadata.filename` dzieje się po stronie serwera (lib/qdrant.ts).
 */
export default function DocumentList({
  refreshKey,
  onChanged,
}: {
  refreshKey: number;
  onChanged: () => void;
}) {
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      setData(await res.json());
    } catch (err) {
      setData({
        ok: false,
        documents: [],
        truncated: false,
        error: err instanceof Error ? err.message : "Błąd odczytu dokumentów",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const confirmDelete = async () => {
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: target.filename }),
      });
      const result: { ok: boolean; deleted: number; error?: string } = await res.json();
      if (!result.ok) {
        setError(result.error ?? "Nieznany błąd");
        return;
      }
      setTarget(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd sieci");
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <p className="font-mono text-xs text-muted">Wczytywanie dokumentów…</p>;
  }

  if (!data.ok) {
    return (
      <p className="font-mono text-xs text-warn">
        Nie udało się odczytać zawartości zasobu: {data.error ?? "nieznany błąd"}
      </p>
    );
  }

  if (data.documents.length === 0) {
    return <p className="font-mono text-xs text-muted">Zasób jest pusty.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full min-w-[560px] font-mono text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-3 py-2 font-normal">Dokument</th>
              <th className="px-3 py-2 font-normal">Chunki</th>
              <th className="px-3 py-2 font-normal">Wgrany</th>
              <th className="px-3 py-2 font-normal text-right">Akcja</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((doc: DocumentSummary) => (
              <tr key={doc.filename ?? "__bez_nazwy__"} className="border-b border-border last:border-0">
                <td className="max-w-[280px] truncate px-3 py-2">
                  {doc.filename ?? <span className="text-muted">(bez nazwy pliku)</span>}
                </td>
                <td className="px-3 py-2 text-muted">{formatNumber(doc.chunks)}</td>
                <td className="px-3 py-2 text-muted">{formatDateTime(doc.ingestedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setTarget({ filename: doc.filename, chunks: doc.chunks })}
                    className="rounded border border-border px-2 py-1 text-[11px] uppercase tracking-widest text-muted hover:border-accent hover:text-accent"
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.truncated && (
        <p className="mt-2 font-mono text-xs text-warn">
          Lista niepełna — zasób ma więcej punktów, niż obejmuje jedno przewinięcie.
        </p>
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded border border-border-strong bg-surface-raised p-5">
            <p className="font-mono text-sm">Usunąć dokument?</p>
            <p className="mt-2 font-mono text-xs text-muted">
              {target.filename ? (
                <>
                  <span className="text-foreground">{target.filename}</span> — usunie{" "}
                  {formatNumber(target.chunks)} chunków.
                </>
              ) : (
                <>Usunie {formatNumber(target.chunks)} chunków bez nazwy pliku.</>
              )}{" "}
              Nie da się cofnąć — dokument trzeba będzie wgrać ponownie.
            </p>
            {error && <p className="mt-3 font-mono text-xs text-accent">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setTarget(null);
                  setError(undefined);
                }}
                disabled={busy}
                className="rounded border border-border-strong px-4 py-2 font-mono text-xs uppercase tracking-widest hover:border-muted disabled:opacity-40"
              >
                Anuluj
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={busy}
                className="rounded border border-accent bg-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 disabled:opacity-40"
              >
                {busy ? "Usuwam…" : "Tak, usuń"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
