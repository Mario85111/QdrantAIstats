import { NextResponse } from "next/server";
import { wipeCollection } from "@/lib/qdrant";

export const dynamic = "force-dynamic";

/**
 * Kasuje wszystkie punkty z bieżącej kolekcji. Nieodwracalne — potwierdzenie
 * dzieje się w UI (modal), nie tutaj. Ten endpoint wykonuje bez pytania.
 */
export async function POST() {
  const result = await wipeCollection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
