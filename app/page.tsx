"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionState } from "@/lib/qdrant";
import type { IngestResponse } from "@/app/api/ingest/route";
import { formatClock, formatNumber } from "@/lib/format";
import IngestHistory from "@/components/IngestHistory";
import Chat from "@/components/Chat";
import StatsCharts from "@/components/StatsCharts";

type IngestState =
  | { phase: "idle" }
  | { phase: "running"; filename: string; startedAt: number }
  | { phase: "finished"; result: IngestResponse };

export default function Home() {
  const [collection, setCollection] = useState<CollectionState | null>(null);
  const [lastReachableAt, setLastReachableAt] = useState<string | null>(null);
  const [ingest, setIngest] = useState<IngestState>({ phase: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshCollection = useCallback(async () => {
    try {
      const res = await fetch("/api/collection", { cache: "no-store" });
      const state: CollectionState = await res.json();
      setCollection(state);
      if (state.reachable) setLastReachableAt(state.takenAt);
    } catch {
      setCollection((prev) => (prev ? { ...prev, reachable: false } : prev));
    }
  }, []);

  useEffect(() => {
    void refreshCollection();
    const timer = setInterval(() => void refreshCollection(), 30_000);
    return () => clearInterval(timer);
  }, [refreshCollection]);

  useEffect(() => {
    if (ingest.phase !== "running") return;
    const timer = setInterval(() => setElapsed(Date.now() - ingest.startedAt), 200);
    return () => clearInterval(timer);
  }, [ingest]);

  const upload = useCallback(
    async (file: File) => {
      setIngest({ phase: "running", filename: file.name, startedAt: Date.now() });
      setElapsed(0);

      const body = new FormData();
      body.append("file", file);

      try {
        const res = await fetch("/api/ingest", { method: "POST", body });
        const result: IngestResponse = await res.json();
        setIngest({ phase: "finished", result });
      } catch (err) {
        setIngest({
          phase: "finished",
          result: {
            id: "local",
            status: "error",
            reason: "pipeline_error",
            message: err instanceof Error ? err.message : "Błąd sieci",
            filename: file.name,
            pointsBefore: null,
            pointsAfter: null,
            durationMs: 0,
            measurementSaved: false,
          },
        });
      }
      void refreshCollection();
      setHistoryKey((k) => k + 1);
    },
    [refreshCollection]
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10 flex items-baseline justify-between border-b border-border pb-5">
        <div>
          <h1 className="font-mono text-lg tracking-tight">
            Qdrant<span className="text-accent">AI</span>stats
          </h1>
          <p className="mt-1 text-sm text-muted">Stan środowiska testowego wiedzy</p>
        </div>
        <StatusPill state={collection} />
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-4">
        <Tile
          label="Punkty w kolekcji"
          value={formatNumber(collection?.pointsCount ?? null)}
          hint={collection?.collection}
        />
        <Tile
          label="Segmenty"
          value={formatNumber(collection?.segmentsCount ?? null)}
          hint={collection?.status ?? undefined}
        />
        <Tile
          label="Wymiar wektora"
          value={collection?.vectorSize ? String(collection.vectorSize) : "—"}
          hint={collection?.vectorSize === 1024 ? "zgodny z bge-m3" : "sprawdź model"}
        />
        <Tile
          label="Ostatni odczyt"
          value={formatClock(collection?.reachable ? collection.takenAt : lastReachableAt)}
          hint={collection?.reachable ? "połączono" : "brak połączenia"}
          muted={!collection?.reachable}
        />
      </section>

      {collection && !collection.reachable && (
        <p className="mt-3 font-mono text-xs text-warn">
          Qdrant nie odpowiada: {(collection.error ?? "nieznany błąd").replace(/\.$/, "")}.
          Pokazane wartości pochodzą z ostatniego udanego odczytu i nie są aktualne.
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Wsad dokumentu</h2>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded border border-dashed px-6 py-14 transition-colors ${
            dragging
              ? "border-accent bg-surface-raised"
              : "border-border-strong bg-surface hover:border-muted"
          } ${ingest.phase === "running" ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md,.csv,.xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <p className="font-mono text-sm">Przeciągnij plik albo kliknij</p>
          <p className="mt-2 text-xs text-muted">PDF · TXT · MD · CSV · XLSX — do 50 MB</p>
        </div>

        {ingest.phase === "running" && (
          <Panel tone="running">
            <span className="font-mono">{ingest.filename}</span>
            <span className="text-muted">
              w toku — {(elapsed / 1000).toFixed(1)} s (limit 120 s)
            </span>
          </Panel>
        )}

        {ingest.phase === "finished" && <Result result={ingest.result} />}

        <div className="mt-8">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
            Historia wsadów
          </h3>
          <IngestHistory refreshKey={historyKey} />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Czat</h2>
        <Chat />
      </section>

      <section className="mt-14">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Statystyki</h2>
        <StatsCharts />
      </section>

      <footer className="mt-16 border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-muted">
        Status wsadu potwierdzany wzrostem liczby punktów w Qdrancie, nie odpowiedzią HTTP z n8n.
        Migawki w tle odpytują wyłącznie Qdranta — nigdy nie wywołują modelu.
      </footer>
    </main>
  );
}

function StatusPill({ state }: { state: CollectionState | null }) {
  const reachable = state?.reachable ?? false;
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span
        className={`inline-block h-2 w-2 rounded-full ${reachable ? "bg-ok" : "bg-accent"}`}
        aria-hidden
      />
      <span className={reachable ? "text-muted" : "text-accent"}>
        {reachable ? "Qdrant online" : "Qdrant offline"}
      </span>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-6">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 font-mono text-2xl ${muted ? "text-muted" : ""}`}>{value}</p>
      {hint && <p className="mt-1 truncate font-mono text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Panel({
  tone,
  children,
}: {
  tone: "running" | "ok" | "error";
  children: React.ReactNode;
}) {
  const border =
    tone === "ok" ? "border-l-ok" : tone === "error" ? "border-l-accent" : "border-l-border-strong";
  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-border border-l-2 bg-surface px-4 py-3 text-sm ${border}`}
    >
      {children}
    </div>
  );
}

function Result({ result }: { result: IngestResponse }) {
  const ok = result.status === "done";
  const delta =
    result.pointsBefore !== null && result.pointsAfter !== null
      ? result.pointsAfter - result.pointsBefore
      : null;

  return (
    <>
      <Panel tone={ok ? "ok" : "error"}>
        <span className="font-mono">{result.filename}</span>
        <span className={ok ? "text-ok" : "text-accent"}>
          {ok ? "w zasobie" : `błąd: ${result.reason ?? "nieznany"}`}
        </span>
      </Panel>

      <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs text-muted md:grid-cols-4">
        <Row label="punkty przed" value={formatNumber(result.pointsBefore)} />
        <Row label="punkty po" value={formatNumber(result.pointsAfter)} />
        <Row label="przyrost" value={delta === null ? "—" : `+${formatNumber(delta)}`} />
        <Row label="czas" value={`${(result.durationMs / 1000).toFixed(1)} s`} />
      </dl>

      {result.message && (
        <p className="mt-3 font-mono text-xs text-warn">{result.message}</p>
      )}

      {!result.measurementSaved && (
        <p className="mt-2 font-mono text-xs text-warn">
          Pomiar niezapisany{result.measurementError ? `: ${result.measurementError}` : ""}
        </p>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
