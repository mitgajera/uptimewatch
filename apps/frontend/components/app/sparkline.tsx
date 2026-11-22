import { cn } from "@/lib/utils";

/**
 * Tiny latency trend line. Zeros are treated as gaps (no data that hour).
 * Purely decorative next to a number, so it is hidden from assistive tech.
 */
export function Sparkline({
  values,
  className,
  width = 96,
  height = 28,
  tone = "text-brand",
}: {
  values: number[] | undefined;
  className?: string;
  width?: number;
  height?: number;
  tone?: string;
}) {
  const points = (values ?? []).map((v, i) => ({ i, v }));
  const present = points.filter((p) => p.v > 0);
  if (present.length < 2) {
    return (
      <svg width={width} height={height} className={cn("text-border", className)} aria-hidden="true">
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="currentColor" strokeDasharray="2 3" />
      </svg>
    );
  }

  const max = Math.max(...present.map((p) => p.v));
  const min = Math.min(...present.map((p) => p.v));
  const span = max - min || 1;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => (i / n) * (width - 2) + 1;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);

  // Split into segments at gaps so missing hours aren't drawn as data.
  const segments: string[] = [];
  let current = "";
  for (const p of points) {
    if (p.v > 0) current += `${current ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`;
    else if (current) {
      segments.push(current);
      current = "";
    }
  }
  if (current) segments.push(current);
  const last = present[present.length - 1]!;

  return (
    <svg width={width} height={height} className={cn(tone, className)} aria-hidden="true">
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <circle cx={x(last.i)} cy={y(last.v)} r="2" fill="currentColor" />
    </svg>
  );
}
