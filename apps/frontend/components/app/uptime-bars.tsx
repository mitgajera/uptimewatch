import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type BarTone = "up" | "degraded" | "down" | "none";

const TONE: Record<BarTone, string> = {
  up: "bg-success/85 hover:bg-success",
  degraded: "bg-warning/85 hover:bg-warning",
  down: "bg-destructive/85 hover:bg-destructive",
  none: "bg-muted hover:bg-muted-foreground/30",
};

export interface UptimeBar {
  key: string;
  tone: BarTone;
  /** Tooltip text, e.g. "Mar 3 · 99.8% uptime". */
  label: string;
}

/** Row of uptime bars (days or check windows) with per-bar tooltips. */
export function UptimeBars({
  bars,
  className,
  barClassName,
  ariaLabel,
}: {
  bars: UptimeBar[];
  className?: string;
  barClassName?: string;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className={cn("flex h-8 items-stretch gap-[2px]", className)}>
      {bars.map((b) => (
        <Tooltip key={b.key} delayDuration={50}>
          <TooltipTrigger asChild>
            <span className={cn("min-w-[2px] flex-1 rounded-[2px] transition-colors", TONE[b.tone], barClassName)} />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {b.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/** Tone for a daily uptime percentage. */
export function uptimeTone(uptime: number | null | undefined): BarTone {
  if (uptime == null) return "none";
  if (uptime >= 99.5) return "up";
  if (uptime >= 95) return "degraded";
  return "down";
}
