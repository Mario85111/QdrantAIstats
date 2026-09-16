import { NextResponse } from "next/server";
import { getCollectionState } from "@/lib/qdrant";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getCollectionState();
  return NextResponse.json(state, { status: 200 });
}
