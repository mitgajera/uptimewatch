import Link from "next/link";
import { Activity, Gauge, Siren, Timer } from "lucide-react";
import { StatCard } from "@/components/app/page";
import type { Overview } from "@/lib/api/types";
import { formatLatency, formatUptime } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { uptimeTextClass } from "@/components/monitor-list/utils";

type Tone = "success" | "warning" | "destructive" | "info" | "muted";

const DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground/50",
};

const s = (n: number) => (n === 1 ? "" : "s");

/** One-line system status, e.g. "2 monitors down". */
export function systemSummary(counts: Overview["counts"]): { tone: Tone; text: string } {
  const { total, down, degraded, maintenance, paused, pending } = counts;
  if (down > 0) {
    const extra = degraded > 0 ? `, ${degraded} degraded` : "";
    return { tone: "destructive", text: `${down} monitor${s(down)} down${extra}` };
  }
  if (degraded > 0) return { tone: "warning", text: `${degraded} monitor${s(degraded)} degraded` };
  const active = total - paused;
  if (active === 0) return { tone: "muted", text: `All ${total} monitor${s(total)} paused` };
  if (pending === active) return { tone: "muted", text: "Waiting for the first checks" };
  if (maintenance > 0)
    return { tone: "info", text: `All systems operational · ${maintenance} in maintenance` };
  return {
    tone: "success",
    text: total === 1 ? "Your monitor is operational" : `All ${active} monitor${s(active)} operational`,
  };
}

export function SummaryLine({ counts }: { counts: Overview["counts"] }) {
  const { tone, text } = systemSummary(counts);
  const live = tone !== "muted";
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="relative inline-flex size-2" aria-hidden="true">
        {live && <span className={cn("animate-status-pulse absolute inset-0 rounded-full", DOT[tone])} />}
        <span className={cn("relative inline-flex size-2 rounded-full", DOT[tone])} />
      </span>
      <span className={cn(tone === "destructive" && "font-medium text-destructive", tone === "warning" && "font-medium text-warning")}>
        {text}
      </span>
    </p>
  );
}

export function KpiRow({ overview }: { overview: Overview }) {
  const { counts } = overview;
  const breakdown = [
    `${counts.up} up`,
    counts.down > 0 && `${counts.down} down`,
    counts.degraded > 0 && `${counts.degraded} degraded`,
    counts.paused > 0 && `${counts.paused} paused`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatCard
        label="Monitors"
        icon={Activity}
        value={counts.total}
        hint={<span className="numeric">{breakdown}</span>}
      />
      <StatCard
        label="Uptime · 24h"
        icon={Gauge}
        value={formatUptime(overview.uptime24h)}
        tone={overview.uptime24h == null ? "text-muted-foreground" : uptimeTextClass(overview.uptime24h)}
        hint={
          <>
            7 days <span className="numeric font-medium text-foreground">{formatUptime(overview.uptime7d)}</span>
          </>
        }
      />
      <StatCard
        label="Avg response · 24h"
        icon={Timer}
        value={formatLatency(overview.avgLatency24h)}
        tone={overview.avgLatency24h == null ? "text-muted-foreground" : undefined}
        hint="Across HTTP and TCP monitors"
      />
      <Link
        href="/dashboard/incidents"
        className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatCard
          label="Open incidents"
          icon={Siren}
          value={overview.openIncidents}
          tone={overview.openIncidents > 0 ? "text-destructive" : undefined}
          hint={overview.openIncidents > 0 ? "Needs attention · view incidents" : "All clear"}
          className={cn(
            "h-full transition-colors duration-150 group-hover:border-foreground/20",
            overview.openIncidents > 0 && "border-destructive/30 bg-destructive/5"
          )}
        />
      </Link>
    </div>
  );
}
