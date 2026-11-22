"use client";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { LineChart } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Panel } from "@/components/app/page";
import type { Overview } from "@/lib/api/types";
import { formatLatency } from "@/lib/monitor-format";

const config = {
  avg: { label: "Avg response", color: "var(--chart-1)" },
} satisfies ChartConfig;

const hourFmt = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function LatencyPanel({ series }: { series: Overview["latencySeries"] }) {
  const stats = useMemo(() => {
    const values = series.map((p) => p.avg).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1]!,
    };
  }, [series]);

  return (
    <Panel
      title="Response time"
      description="Hourly average across HTTP and TCP monitors, last 24 hours"
      actions={
        stats && (
          <dl className="hidden items-center gap-4 text-right sm:flex">
            <div>
              <dt className="text-[11px] text-muted-foreground">Fastest</dt>
              <dd className="numeric text-sm font-medium">{formatLatency(stats.min)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Slowest</dt>
              <dd className="numeric text-sm font-medium">{formatLatency(stats.max)}</dd>
            </div>
          </dl>
        )
      }
      bodyClassName="px-2 pb-3 pt-4 sm:px-4"
    >
      {stats ? (
        <ChartContainer config={config} className="aspect-auto h-56 w-full sm:h-64">
          <AreaChart data={series} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="overview-latency-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-avg)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-avg)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) => hourFmt.format(t)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickCount={4}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`)}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, payload) => {
                    const t = payload?.[0]?.payload?.t as number | undefined;
                    return t ? fullFmt.format(t) : "";
                  }}
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">Avg response</span>
                      <span className="numeric font-medium text-foreground">{formatLatency(Number(value))}</span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="avg"
              type="monotone"
              stroke="var(--color-avg)"
              strokeWidth={2}
              fill="url(#overview-latency-fill)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-center sm:h-64">
          <span className="grid size-10 place-items-center rounded-full border bg-muted/50">
            <LineChart className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">No response data yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Response times appear here after your HTTP and TCP monitors run their first checks.
          </p>
        </div>
      )}
    </Panel>
  );
}
