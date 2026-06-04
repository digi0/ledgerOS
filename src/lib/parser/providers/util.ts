export function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function prune(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)),
  );
}

export function firstLine(text: string, skip?: RegExp): string | null {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 2 && (!skip || !skip.test(l)));
  return line ?? null;
}
