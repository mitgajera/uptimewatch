import { cn } from "@/lib/utils";
import { bucketTicks } from "@/lib/monitor-format";
import type { Tick } from "@/lib/api/types";

const COLOR = {
  up: "bg-success",
  down: "bg-destructive",
  none: "bg-muted",
} as const;

/** Last 30 minutes as one bar per minute, oldest on the left. */
export function RecentChecksBar({ ticks, className }: { ticks: Tick[]; className?: string }) {
  const buckets = bucketTicks(ticks);
  const down = buckets.filter((b) => b === "down").length;
  const known = buckets.filter((b) => b !== "none").length;

  return (
    <div
      className={cn("flex h-6 items-stretch gap-px", className)}
      role="img"
      aria-label={
        known === 0
          ? "No checks in the last 30 minutes"
          : `Last 30 minutes: ${known - down} healthy, ${down} failing minute(s)`
      }
    >
      {buckets.map((b, i) => (
        <span key={i} className={cn("flex-1 rounded-[2px]", COLOR[b])} />
      ))}
    </div>
  );
}
