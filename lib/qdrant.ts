import { config } from "./config";

export type CollectionState = {
  reachable: boolean;
  collection: string;
  pointsCount: number | null;
  segmentsCount: number | null;
  status: string | null;
  vectorSize: number | null;
  takenAt: string;
  error?: string;
};

/**
 * Odczyt stanu kolekcji prosto z Qdranta.
 *
 * Ta funkcja NIGDY nie wywołuje n8n ani modelu LLM — SCOPE.md, ryzyko R-3.
 * Przy błędzie nie rzuca wyjątkiem: brak połączenia jest stanem do pokazania,
 * nie awarią aplikacji (M-4).
 */
export async function getCollectionState(): Promise<CollectionState> {
  const takenAt = new Date().toISOString();
  let collection = "—";

  try {
    // Brak konfiguracji też jest stanem do pokazania, nie wywróceniem aplikacji.
    collection = config.qdrant.collection;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.qdrant.apiKey) headers["api-key"] = config.qdrant.apiKey;

    const res = await fetch(`${config.qdrant.url}/collections/${collection}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        reachable: false,
        collection,
        pointsCount: null,
        segmentsCount: null,
        status: null,
        vectorSize: null,
        takenAt,
        error: `Qdrant odpowiedział ${res.status}`,
      };
    }

    const body = await res.json();
    const result = body?.result ?? {};
    const vectors = result?.config?.params?.vectors;

    return {
      reachable: true,
      collection,
      pointsCount: result.points_count ?? null,
      segmentsCount: result.segments_count ?? null,
      status: result.status ?? null,
      vectorSize: typeof vectors?.size === "number" ? vectors.size : null,
      takenAt,
    };
  } catch (err) {
    return {
      reachable: false,
      collection,
      pointsCount: null,
      segmentsCount: null,
      status: null,
      vectorSize: null,
      takenAt,
      error: err instanceof Error ? err.message : "Nieznany błąd połączenia",
    };
  }
}

/** Liczba punktów albo null, gdy Qdrant milczy. Używane do potwierdzenia wsadu (R-2). */
export async function getPointsCount(): Promise<number | null> {
  const state = await getCollectionState();
  return state.reachable ? state.pointsCount : null;
}
