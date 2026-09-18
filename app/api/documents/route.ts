import { NextResponse } from "next/server";
import { listDocuments } from "@/lib/qdrant";

export const dynamic = "force-dynamic";

export type DocumentsResponse = Awaited<ReturnType<typeof listDocuments>>;

/** Zawartość zasobu wiedzy widziana z aplikacji — bez zaglądania do Qdranta. */
export async function GET() {
  const result = await listDocuments();
  return NextResponse.json<DocumentsResponse>(result, { status: result.ok ? 200 : 502 });
}
