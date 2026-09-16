"use client";

import { useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { StatsResponse } from "@/app/api/stats/route";

const RANGES = ["24h", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

const tickFormatter = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const tooltipLabelFormatter = (label: React.ReactNode) =>
  typeof label === "string" ? tickFormatter(label) : String(label ?? "");

/** Wykresy czasu odpowiedzi i wzrostu zasobu, z przełącznikiem zakresu — M-5. */
export default function StatsCharts() {
  const [range, setRange] = useState<Range>("24h");
  const [data, setData] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stats?range=${range}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((d: StatsResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (data && !data.enabled) {
    return (
      <p className="font-mono text-xs text-muted">
        Google Sheets nie jest skonfigurowany — wykresy niedostępne.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 font-mono text-xs">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded border px-3 py-1 uppercase tracking-widest ${
              range === r
                ? "border-foreground text-foreground"
                : "border-border text-muted hover:border-muted"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartPanel
          title="Czas odpowiedzi czatu"
          empty={!data || data.responseTimes.length < 2}
          emptyHint="Potrzeba min. 2 pomiarów — zadaj kilka pytań w czacie."
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.responseTimes ?? []}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="at"
                tickFormatter={tickFormatter}
                stroke="var(--color-muted)"
                fontSize={10}
                fontFamily="var(--font-geist-mono)"
                minTickGap={40}
              />
              <YAxis
                stroke="var(--color-muted)"
                fontSize={10}
                fontFamily="var(--font-geist-mono)"
                width={50}
                unit="ms"
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                contentStyle={{
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border)",
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="totalMs"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Rozmiar zasobu (punkty)"
          empty={!data || data.collectionSize.length < 2}
          emptyHint="Potrzeba min. 2 migawek — pierwsza pojawia się przy starcie aplikacji, kolejne co 15 min."
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.collectionSize ?? []}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="at"
                tickFormatter={tickFormatter}
                stroke="var(--color-muted)"
                fontSize={10}
                fontFamily="var(--font-geist-mono)"
                minTickGap={40}
              />
              <YAxis
                stroke="var(--color-muted)"
                fontSize={10}
                fontFamily="var(--font-geist-mono)"
                width={50}
              />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                contentStyle={{
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border)",
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="pointsCount"
                stroke="var(--color-ok)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  empty,
  emptyHint,
  children,
}: {
  title: string;
  empty: boolean;
  emptyHint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">{title}</p>
      {empty ? (
        <p className="flex h-[220px] items-center justify-center text-center font-mono text-xs text-muted">
          {emptyHint}
        </p>
      ) : (
        children
      )}
    </div>
  );
}
