/** Fisher-Yates shuffle — returns a new shuffled array. */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Generate a random access code, e.g. "ALPHA-942". */
export function generateAccessCode(prefix: string): string {
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${prefix.toUpperCase()}-${suffix}`;
}
