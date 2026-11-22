"use client";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { AnalyticsRange, MonitorAnalytics } from "@/lib/api/types";
import { formatLatency } from "@/lib/monitor-format";

const config = {
  avgLatency: { label: "Response time", color: "var(--chart-1)" },
} satisfies ChartConfig;

const tickFormat = (range: AnalyticsRange) =>
  new Intl.DateTimeFormat(
    undefined,
    range === "24h" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" }
  );

const fullFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type Point = MonitorAnalytics["series"][number];

/** Merge consecutive failing buckets into shaded spans. */
function downSpans(points: Point[]): { x1: number; x2: number }[] {
  if (points.length < 2) return [];
  const diffs = points.slice(1).map((p, i) => p.t - points[i]!.t).sort((a, b) => a - b);
  const step = diffs[Math.floor(diffs.length / 2)] ?? 0;
  const spans: { x1: number; x2: number }[] = [];
  for (const p of points) {
    if (p.up) continue;
    const x1 = p.t - step / 2;
    const x2 = p.t + step / 2;
    const last = spans[spans.length - 1];
    if (last && x1 <= last.x2 + 1) last.x2 = x2;
    else spans.push({ x1, x2 });
  }
  const min = points[0]!.t;
  const max = points[points.length - 1]!.t;
  return spans.map((s) => ({ x1: Math.max(s.x1, min), x2: Math.min(s.x2, max) }));
}

/** Response time over the selected range, with the average and failing periods marked. */
export function ResponseTimeChart({
  series,
  range,
  average,
  degradedThresholdMs,
}: {
  series: Point[];
  range: AnalyticsRange;
  average: number | null;
  degradedThresholdMs?: number | null;
}) {
  const points = useMemo(() => [...series].sort((a, b) => a.t - b.t), [series]);
  const spans = useMemo(() => downSpans(points), [points]);
  const fmt = tickFormat(range);

  if (points.length < 2) {
    return (
      <div className="grid h-64 place-items-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        <p className="max-w-xs">Not enough checks in this range yet. The chart fills in as results arrive.</p>
      </div>
    );
  }

  const failing = points.filter((p) => !p.up).length;
  const maxLatency = Math.max(...points.map((p) => p.avgLatency));
  const showThreshold = degradedThresholdMs != null && degradedThresholdMs <= maxLatency * 1.25;
  const label = `Response time over the last ${range}${average != null ? `, averaging ${formatLatency(average)}` : ""}${
    failing ? `, with ${failing} period${failing === 1 ? "" : "s"} containing failures` : ""
  }.`;

  return (
    <div role="img" aria-label={label}>
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <AreaChart data={points} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rt-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-avgLatency)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-avgLatency)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          {spans.map((s, i) => (
            <ReferenceArea
              key={i}
              x1={s.x1}
              x2={s.x2}
              fill="var(--destructive)"
              fillOpacity={0.1}
              stroke="var(--destructive)"
              strokeOpacity={0.2}
              ifOverflow="extendDomain"
            />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => fmt.format(new Date(t))}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={48}
          />
          <YAxis
            width={58}
            tickFormatter={(v) => formatLatency(v)}
            tickLine={false}
            axisLine={false}
            tickCount={4}
          />
          {showThreshold && (
            <ReferenceLine
              y={degradedThresholdMs!}
              stroke="var(--warning)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              ifOverflow="extendDomain"
              label={{ value: "Degraded", position: "insideTopRight", fill: "var(--warning)", fontSize: 10 }}
            />
          )}
          {average != null && average > 0 && (
            <ReferenceLine
              y={average}
              stroke="var(--muted-foreground)"
              strokeDasharray="2 4"
              label={{
                value: `avg ${formatLatency(average)}`,
                position: "insideBottomRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
          )}
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const t = payload?.[0]?.payload?.t as number | undefined;
                  return t ? fullFormat.format(new Date(t)) : "";
                }}
                formatter={(value, _name, item) => {
                  const up = (item.payload as Point).up;
                  return (
                    <div className="grid w-full gap-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-[2px] bg-chart-1" aria-hidden="true" />
                          Response time
                        </span>
                        <span className="numeric font-mono font-medium text-foreground">
                          {formatLatency(Number(value))}
                        </span>
                      </div>
                      {!up && <span className="font-medium text-destructive">Failed checks in this period</span>}
                    </div>
                  );
                }}
              />
            }
          />
          <Area
            dataKey="avgLatency"
            type="monotone"
            stroke="var(--color-avgLatency)"
            strokeWidth={1.75}
            fill="url(#rt-fill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-chart-1" aria-hidden="true" />
          Response time
        </span>
        {average != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-muted-foreground" aria-hidden="true" />
            Average
          </span>
        )}
        {spans.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-destructive/15 ring-1 ring-inset ring-destructive/30" aria-hidden="true" />
            Failures
          </span>
        )}
        {showThreshold && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-warning" aria-hidden="true" />
            Degraded threshold
          </span>
        )}
      </div>
    </div>
  );
}
