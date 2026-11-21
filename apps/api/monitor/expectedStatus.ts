/**
 * Parse an expected-status spec such as "200-299,301,404" into a matcher.
 * Returns null when the spec is malformed so callers can reject it.
 */
export function parseExpectedStatus(spec: string): ((code: number) => boolean) | null {
  const parts = spec
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const ranges: [number, number][] = [];
  for (const part of parts) {
    const m = part.match(/^(\d{3})(?:\s*-\s*(\d{3}))?$/);
    if (!m) return null;
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : lo;
    if (lo < 100 || hi > 599 || lo > hi) return null;
    ranges.push([lo, hi]);
  }

  return (code) => ranges.some(([lo, hi]) => code >= lo && code <= hi);
}

export function isValidExpectedStatus(spec: string): boolean {
  return parseExpectedStatus(spec) !== null;
}
