import { cn } from "@/lib/utils";
import { STATE_LABEL, type MonitorState } from "@/lib/monitor-format";

const DOT: Record<MonitorState, string> = {
  up: "bg-success",
  down: "bg-destructive",
  paused: "bg-muted-foreground",
  pending: "bg-warning",
};

const TEXT: Record<MonitorState, string> = {
  up: "text-success",
  down: "text-destructive",
  paused: "text-muted-foreground",
  pending: "text-warning",
};

/** Colored dot; a soft pulse marks a monitor that is currently down. */
export function StatusDot({ state, className }: { state: MonitorState; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)} aria-hidden="true">
      {state === "down" && (
        <span className="absolute inline-flex size-full rounded-full bg-destructive opacity-60 motion-safe:animate-ping" />
      )}
      <span className={cn("relative inline-flex size-2.5 rounded-full", DOT[state])} />
    </span>
  );
}

/** Dot + label; the label carries meaning so status never relies on color alone. */
export function StatusLabel({ state, className }: { state: MonitorState; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", TEXT[state], className)}>
      <StatusDot state={state} />
      {STATE_LABEL[state]}
    </span>
  );
}
