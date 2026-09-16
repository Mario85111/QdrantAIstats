import { NextResponse } from "next/server";
import { listAssistantTimings, listCollectionSnapshots } from "@/lib/sheets";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

const RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
};

export type StatsResponse = {
  enabled: boolean;
  range: string;
  responseTimes: { at: string; totalMs: number }[];
  collectionSize: { at: string; pointsCount: number | null }[];
  error?: string;
};

/** Surowiec pod wykresy M-5, z przełącznikiem zakresu 24h / 7d / 30d. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "24h";
  const windowMs = RANGE_MS[range] ?? RANGE_MS["24h"];
  const sinceISO = new Date(Date.now() - windowMs).toISOString();

  if (!config.sheets.enabled) {
    return NextResponse.json<StatsResponse>({
      enabled: false,
      range,
      responseTimes: [],
      collectionSize: [],
    });
  }

  const [timings, snapshots] = await Promise.all([
    listAssistantTimings(sinceISO),
    listCollectionSnapshots(sinceISO),
  ]);

  return NextResponse.json<StatsResponse>({
    enabled: timings.ok && snapshots.ok,
    range,
    responseTimes: timings.rows.map((r) => ({ at: r.createdAt, totalMs: r.totalMs })),
    collectionSize: snapshots.rows.map((r) => ({ at: r.takenAt, pointsCount: r.pointsCount })),
    error: timings.error ?? snapshots.error,
  });
}
