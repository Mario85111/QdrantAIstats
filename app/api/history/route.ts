import { NextResponse } from "next/server";
import { listIngestJobs } from "@/lib/sheets";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export type HistoryResponse = {
  enabled: boolean;
  jobs: Awaited<ReturnType<typeof listIngestJobs>>["rows"];
  error?: string;
};

/** Ostatnie 50 wsadów — M-2. */
export async function GET() {
  if (!config.sheets.enabled) {
    return NextResponse.json<HistoryResponse>({ enabled: false, jobs: [] });
  }
  const { rows, ok, error } = await listIngestJobs(50);
  return NextResponse.json<HistoryResponse>({ enabled: ok, jobs: rows, error });
}
