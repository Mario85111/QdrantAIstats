"use client";

import { useEffect, useState } from "react";
import type { IngestJobRow } from "@/lib/sheets";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";

/** Ostatnie wsady, najnowsze pierwsze — M-2. Odświeża się po każdym nowym wsadzie. */
export default function IngestHistory({ refreshKey }: { refreshKey: number }) {
  const [jobs, setJobs] = useState<IngestJobRow[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { enabled: boolean; jobs: IngestJobRow[]; error?: string }) => {
        if (cancelled) return;
        setJobs(data.jobs);
        setEnabled(data.enabled);
        setError(data.error);
      })
      .catch((err) => {
        if (cancelled) return;
        setJobs([]);
        setError(err instanceof Error ? err.message : "Błąd odczytu historii");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!enabled) {
    return (
      <p className="font-mono text-xs text-muted">
        Google Sheets nie jest skonfigurowany — historia wsadów niedostępna.
      </p>
    );
  }

  if (jobs === null) {
    return <p className="font-mono text-xs text-muted">Wczytywanie historii…</p>;
  }

  if (jobs.length === 0) {
    return <p className="font-mono text-xs text-muted">Brak wsadów w historii.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full min-w-[640px] font-mono text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-3 py-2 font-normal">Plik</th>
            <th className="px-3 py-2 font-normal">Rozmiar</th>
            <th className="px-3 py-2 font-normal">Zakończono</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 font-normal">Przyrost punktów</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const delta =
              job.pointsBefore !== null && job.pointsAfter !== null
                ? job.pointsAfter - job.pointsBefore
                : null;
            return (
              <tr key={job.id} className="border-b border-border last:border-0">
                <td className="max-w-[200px] truncate px-3 py-2">{job.filename}</td>
                <td className="px-3 py-2 text-muted">{formatBytes(job.sizeBytes)}</td>
                <td className="px-3 py-2 text-muted">{formatDateTime(job.finishedAt)}</td>
                <td className={`px-3 py-2 ${job.status === "done" ? "text-ok" : "text-accent"}`}>
                  {job.status === "done" ? "w zasobie" : "błąd"}
                </td>
                <td className="px-3 py-2 text-muted">
                  {delta === null ? "—" : `+${formatNumber(delta)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="border-t border-border px-3 py-2 text-xs text-warn">{error}</p>}
    </div>
  );
}
