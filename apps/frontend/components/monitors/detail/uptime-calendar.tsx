"use client";
import { Panel } from "@/components/app/page";
import { UptimeBars, uptimeTone, type UptimeBar } from "@/components/app/uptime-bars";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitorCalendar } from "@/hooks/queries";
import { formatUptime } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { QueryError } from "../states";

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Last 90 days as daily uptime bars with an overall figure. */
export function UptimeCalendar({ monitorId }: { monitorId: string }) {
  const calendar = useMonitorCalendar(monitorId);
  const days = calendar.data ?? [];

  const totals = days.reduce(
    (acc, d) => ({ checks: acc.checks + d.checks, down: acc.down + d.downChecks }),
    { checks: 0, down: 0 }
  );
  const overall = totals.checks ? ((totals.checks - totals.down) / totals.checks) * 100 : null;
  const incidentDays = days.filter((d) => d.downChecks > 0).length;

  const bars: UptimeBar[] = days.map((d) => {
    const date = dayFormat.format(new Date(`${d.date}T00:00:00Z`));
    const detail = d.checks
      ? `${formatUptime(d.uptime)} uptime · ${d.checks.toLocaleString()} checks${d.downChecks ? `, ${d.downChecks.toLocaleString()} failed` : ""}`
      : "No data";
    return { key: d.date, tone: uptimeTone(d.checks ? d.uptime : null), label: `${date} · ${detail}` };
  });

  return (
    <Panel
      title="Uptime, last 90 days"
      description="Each bar is one day (UTC). Hover for details."
      actions={
        overall != null ? (
          <span
            className={cn(
              "numeric text-sm font-semibold",
              overall >= 99.5 ? "text-success" : overall >= 95 ? "text-warning" : "text-destructive"
            )}
          >
            {formatUptime(overall)}
          </span>
        ) : null
      }
    >
      {calendar.isPending ? (
        <Skeleton className="h-8 w-full" />
      ) : calendar.isError ? (
        <QueryError
          error={calendar.error}
          onRetry={() => calendar.refetch()}
          retrying={calendar.isFetching}
          title="Couldn't load uptime history"
          className="flex flex-col items-center gap-3 py-4 text-center"
        />
      ) : days.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No history yet. Bars appear after the first day of checks.</p>
      ) : (
        <>
          {/* 90 bars don't fit a phone; show the last 30 there. */}
          <UptimeBars
            bars={bars.slice(-30)}
            ariaLabel={`Daily uptime for the last ${Math.min(30, days.length)} days`}
            className="h-9 sm:hidden"
          />
          <UptimeBars
            bars={bars}
            ariaLabel={`Daily uptime for the last ${days.length} days, ${formatUptime(overall)} overall`}
            className="hidden h-9 sm:flex"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="sm:hidden">{Math.min(30, days.length)} days ago</span>
            <span className="hidden sm:inline">{days.length} days ago</span>
            <span className="hidden sm:inline">
              {incidentDays ? (
                <>
                  <span className="numeric">{incidentDays}</span> day{incidentDays === 1 ? "" : "s"} with failures
                </>
              ) : (
                "No failures recorded"
              )}
            </span>
            <span>Today</span>
          </div>
        </>
      )}
    </Panel>
  );
}
