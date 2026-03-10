/**
 * Difficulty points awarded per correctly solved group.
 * Revealed groups (after a wrong guess) do NOT earn these points.
 */
export const DIFFICULTY_POINTS: Record<number, number> = {
  1: 100, // Yellow / easiest
  2: 200, // Green
  3: 300, // Blue
  4: 400, // Purple / hardest
};

/** Format elapsed seconds as "1m 23s" or "45s". */
export function formatDuration(startTime: Date, endTime: Date): string {
  const secs = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Score formula:
 *   difficulty points  = sum of DIFFICULTY_POINTS for each correctly solved group (max 1000)
 *   speed bonus        = max(0, 500 - ((seconds - 30) * 5))          — capped at [0, 500]
 *   mistake penalty    = mistakes * 150
 *   final              = max(0, difficultyPoints + speedBonus - penalty)
 *
 * Returns 0 for LOST sessions.
 */
export function computeScore(
  status: "WON" | "LOST",
  startTime: Date,
  endTime: Date,
  mistakes: number,
  difficultyPoints: number
): number {
  if (status === "LOST") return 0;

  const seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  const speedBonus = Math.max(0, 500 - Math.max(0, seconds - 30) * 5);
  return Math.max(0, difficultyPoints + speedBonus - mistakes * 150);
}
