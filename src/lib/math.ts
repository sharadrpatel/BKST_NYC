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
 *   speed bonus        = 500                                           — capped at 500
 *   mistake penalty    = mistakes * 150
 *   time penalty       = (elapsedSeconds / 60) * 2
 *   final              = max(0, difficultyPoints + speedBonus - mistakePenalty - timePenalty)
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

  const elapsedSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
  const minutes = elapsedSeconds / 60;
  const speedBonus = 500;
  const mistakePenalty = mistakes * 150;
  const timePenalty = minutes * 2;
  const rawScore = difficultyPoints + speedBonus - mistakePenalty - timePenalty;

  if (difficultyPoints > 0 && rawScore > 0) {
    return Math.max(1, Math.round(rawScore));
  }

  return Math.max(0, Math.round(rawScore));
}
