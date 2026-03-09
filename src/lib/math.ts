/**
 * Score formula (from docs/plan.md §7):
 *   Base: 1000 (awarded only on WON sessions)
 *   Speed bonus: max(0, 500 - ((seconds - 30) * 5))  — capped at [0, 500]
 *   Mistake penalty: mistakes * 150
 *
 * Returns 0 for LOST sessions.
 */
/** Format elapsed seconds as "1m 23s" or "45s". */
export function formatDuration(startTime: Date, endTime: Date): string {
  const secs = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function computeScore(
  status: "WON" | "LOST",
  startTime: Date,
  endTime: Date,
  mistakes: number
): number {
  if (status === "LOST") return 0;

  const seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  const speedBonus = Math.max(0, 500 - Math.max(0, seconds - 30) * 5);
  return 1000 + speedBonus - mistakes * 150;
}
