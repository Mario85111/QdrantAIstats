import { randomUUID } from "node:crypto";
import { config } from "./config";
import { getCollectionState } from "./qdrant";
import { appendCollectionSnapshot } from "./sheets";

/**
 * Migawka stanu kolekcji co 15 minut — M-6.
 *
 * Odpytuje WYŁĄCZNIE REST Qdranta. Nigdy nie wywołuje n8n ani modelu LLM —
 * SCOPE.md, ryzyko R-3: koszt zapytań nie może rosnąć bez udziału operatora.
 *
 * Zabezpieczone przed podwójnym startem przy hot-reloadzie w `next dev`
 * przez flagę na globalThis — register() w instrumentation.ts może się
 * wywołać ponownie przy każdym przeładowaniu modułu.
 */

declare global {
  var __qdrantSnapshotTimer: ReturnType<typeof setInterval> | undefined;
}

async function takeSnapshot() {
  const state = await getCollectionState();
  const result = await appendCollectionSnapshot({
    id: randomUUID(),
    takenAt: state.takenAt,
    pointsCount: state.pointsCount,
    segmentsCount: state.segmentsCount,
    status: state.status,
    reachable: state.reachable,
  });
  if (!result.written) {
    console.warn("[snapshot] pomiar niezapisany:", result.error);
  }
}

export function startSnapshotScheduler() {
  if (globalThis.__qdrantSnapshotTimer) return;

  // Pierwsza migawka od razu, żeby nie czekać 15 minut na pierwszy punkt danych.
  void takeSnapshot();

  globalThis.__qdrantSnapshotTimer = setInterval(() => {
    void takeSnapshot();
  }, config.snapshotIntervalMs);

  // Nie blokuj zamknięcia procesu wyłącznie z powodu tego interwału.
  globalThis.__qdrantSnapshotTimer.unref?.();
}
