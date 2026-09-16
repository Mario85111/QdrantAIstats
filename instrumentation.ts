/**
 * Uruchamia zadanie w tle raz przy starcie serwera — M-6.
 * https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSnapshotScheduler } = await import("./lib/snapshotScheduler");
    startSnapshotScheduler();
  }
}
