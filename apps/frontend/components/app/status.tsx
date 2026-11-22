import { Activity, Globe, HeartPulse, Network, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATE_LABEL, type MonitorState } from "@/lib/monitor-format";
import type { MonitorType } from "@/lib/api/types";

/** Background, text and soft-fill classes per state, all from theme tokens. */
export const STATE_STYLES: Record<MonitorState, { dot: string; text: string; soft: string }> = {
  up: { dot: "bg-success", text: "text-success", soft: "bg-success/10 text-success ring-success/20" },
  degraded: { dot: "bg-warning", text: "text-warning", soft: "bg-warning/10 text-warning ring-warning/25" },
  down: { dot: "bg-destructive", text: "text-destructive", soft: "bg-destructive/10 text-destructive ring-destructive/25" },
  maintenance: { dot: "bg-info", text: "text-info", soft: "bg-info/10 text-info ring-info/25" },
  paused: { dot: "bg-muted-foreground/60", text: "text-muted-foreground", soft: "bg-muted text-muted-foreground ring-border" },
  pending: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", soft: "bg-muted text-muted-foreground ring-border" },
};

/** Status dot; live states (up, down) get a calm pulse. */
export function StatusDot({ state, className, live = true }: { state: MonitorState; className?: string; live?: boolean }) {
  const pulse = live && (state === "up" || state === "down" || state === "degraded");
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden="true">
      {pulse && <span className={cn("animate-status-pulse absolute inset-0 rounded-full", STATE_STYLES[state].dot)} />}
      <span className={cn("relative inline-flex size-full rounded-full", STATE_STYLES[state].dot)} />
    </span>
  );
}

/** Pill with dot + label; the label carries meaning so status never relies on color alone. */
export function StatusBadge({ state, className, label }: { state: MonitorState; className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        STATE_STYLES[state].soft,
        className
      )}
    >
      <StatusDot state={state} live={false} />
      {label ?? STATE_LABEL[state]}
    </span>
  );
}

const TYPE_ICON: Record<MonitorType, typeof Globe> = {
  http: Globe,
  tcp: Server,
  dns: Network,
  heartbeat: HeartPulse,
};

export function MonitorTypeIcon({ type, className }: { type: MonitorType; className?: string }) {
  const Icon = TYPE_ICON[type] ?? Activity;
  return <Icon className={cn("size-4", className)} aria-hidden="true" />;
}
