"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsRange, MonitorAnalytics } from "@/lib/api/types";
import { formatLatency } from "@/lib/monitor-format";

const timeFormat = (range: AnalyticsRange) =>
  new Intl.DateTimeFormat(
    undefined,
    range === "24h" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" }
  );

/** Response time over the selected range; buckets with failures are flagged in the tooltip. */
export function LatencyChart({ data, range }: { data: MonitorAnalytics["series"]; range: AnalyticsRange }) {
  if (data.length < 2) {
    return (
      <div className="grid h-56 place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
        Not enough data yet. Checks are still coming in.
      </div>
    );
  }

  const fmt = timeFormat(range);
  const points = data.map((p) => ({ t: p.t, latency: p.avgLatency, up: p.up }));

  return (
    <div className="h-56 w-full" role="img" aria-label={`Response time chart for the last ${range}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => fmt.format(new Date(t))}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            width={56}
            tickFormatter={(v) => formatLatency(v)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <p className="text-muted-foreground">{new Date(p.t).toLocaleString()}</p>
                  <p className="font-medium tabular-nums">{formatLatency(p.latency)}</p>
                  {!p.up && <p className="font-medium text-destructive">Failures in this period</p>}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#latencyFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
