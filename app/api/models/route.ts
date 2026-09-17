import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export type ModelsResponse = {
  models: string[];
  defaultModel: string;
};

/** Lista modeli czatu do wyboru w panelu — z konfiguracji, nie z API dostawcy. */
export async function GET() {
  return NextResponse.json<ModelsResponse>({
    models: config.chat.models,
    defaultModel: config.chat.defaultModel,
  });
}
