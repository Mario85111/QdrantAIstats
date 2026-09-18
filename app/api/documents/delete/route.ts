import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/qdrant";

export const dynamic = "force-dynamic";

/**
 * Kasuje wszystkie chunki jednego dokumentu. Nieodwracalne — potwierdzenie
 * dzieje się w UI (modal), nie tutaj.
 *
 * `filename: null` celowo oznacza punkty bez metadanej `filename` (wgrane,
 * zanim workflow ją zapisywał). Bez tego przypadku byłaby to grupa widoczna
 * na liście, której nie da się usunąć.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !("filename" in body)) {
    return NextResponse.json(
      { ok: false, deleted: 0, error: "Brak pola `filename` (null oznacza dokumenty bez nazwy)" },
      { status: 400 }
    );
  }

  const filename: string | null = typeof body.filename === "string" ? body.filename : null;
  const result = await deleteDocument(filename);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
