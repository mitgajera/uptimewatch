import { BellRing, Search } from "lucide-react";
import { LogoMark } from "@/components/app/logo";
import { Sparkline } from "@/components/app/sparkline";
import { MonitorTypeIcon, StatusBadge, StatusDot } from "@/components/app/status";
import type { MonitorState } from "@/lib/monitor-format";
import type { MonitorType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/*
 * Decorative product preview for the landing page. Everything here is static
 * demo data built from the real components; it is exposed to assistive tech as
 * a single labelled image.
 */

type Tone = "up" | "degraded" | "down";

/** Deterministic pseudo-random bars so server and client render the same. */
function bars(seed: number, count: number, incidents: Record<number, Tone> = {}): Tone[] {
  return Array.from({ length: count }, (_, i) => incidents[i] ?? (((seed * (i + 7)) % 53 === 0 ? "degraded" : "up") as Tone));
}

function wave(base: number, amp: number, seed: number, n = 24): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(base + amp * Math.sin((i + seed) / 2.3) + ((i * seed) % 7) * 3));
}

const MONITORS: {
  name: string;
  target: string;
  type: MonitorType;
  state: MonitorState;
  latency: string;
  uptime: string;
  spark: number[];
  bars: Tone[];
}[] = [
  {
    name: "api.acme.dev",
    target: "GET /health",
    type: "http",
    state: "up",
    latency: "142 ms",
    uptime: "99.99%",
    spark: wave(140, 18, 3),
    bars: bars(5, 30),
  },
  {
    name: "checkout",
    target: "POST /v1/carts",
    type: "http",
    state: "degraded",
    latency: "1.84 s",
    uptime: "99.71%",
    spark: [...wave(320, 40, 5, 18), 900, 1300, 1650, 1800, 1760, 1840],
    bars: bars(3, 30, { 27: "degraded", 28: "degraded", 29: "degraded", 12: "down" }),
  },
  {
    name: "db-primary",
    target: "10.0.4.12:5432",
    type: "tcp",
    state: "up",
    latency: "4 ms",
    uptime: "100%",
    spark: wave(4, 1, 2),
    bars: bars(1, 30),
  },
  {
    name: "nightly-backup",
    target: "every 24h · 15m grace",
    type: "heartbeat",
    state: "up",
    latency: "—",
    uptime: "100%",
    spark: [],
    bars: bars(11, 30),
  },
];

const BAR_TONE: Record<Tone, string> = {
  up: "bg-success/80",
  degraded: "bg-warning/85",
  down: "bg-destructive/85",
};

function Bars({ tones, className }: { tones: Tone[]; className?: string }) {
  return (
    <div className={cn("flex h-6 items-stretch gap-[2px]", className)}>
      {tones.map((t, i) => (
        <span key={i} className={cn("min-w-[2px] flex-1 rounded-[2px]", BAR_TONE[t])} />
      ))}
    </div>
  );
}

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Preview of the UptimeWatch dashboard: four monitors with uptime bars, one degraded, and a Slack alert."
      className={cn("relative", className)}
    >
      <div aria-hidden="true" className="overflow-hidden rounded-xl border bg-card shadow-xs ring-1 ring-foreground/[0.03]">
        {/* Window chrome */}
        <div className="flex h-10 items-center gap-3 border-b bg-surface px-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          </div>
          <div className="mx-auto flex h-6 w-full max-w-xs items-center justify-center gap-2 rounded-md border bg-background px-2 font-mono text-[11px] text-muted-foreground">
            app.uptimewatch.dev/dashboard
          </div>
          <span className="w-10" />
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="hidden w-44 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 lg:flex">
            <div className="mb-3 flex items-center gap-2">
              <LogoMark className="size-6" />
              <span className="text-[13px] font-semibold">UptimeWatch</span>
            </div>
            {["Overview", "Monitors", "Incidents", "Status pages", "Integrations"].map((l, i) => (
              <span
                key={l}
                className={cn(
                  "flex h-7 items-center rounded-md px-2 text-[12px] text-sidebar-foreground",
                  i === 1 && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                )}
              >
                {l}
              </span>
            ))}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Monitors</p>
                <p className="numeric text-[11px] text-muted-foreground">3 up · 1 degraded · 0 down</p>
              </div>
              <span className="hidden h-7 items-center gap-2 rounded-md border bg-background px-2 text-[11px] text-muted-foreground sm:flex">
                <Search className="size-3" />
                Search…
                <kbd className="rounded border bg-muted px-1 font-mono text-[9px]">⌘K</kbd>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Uptime · 30d", "99.97%", "text-foreground"],
                ["Avg latency", "184 ms", "text-foreground"],
                ["Open incidents", "1", "text-warning"],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border bg-background p-2 sm:p-2.5">
                  <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">{label}</p>
                  <p className={cn("numeric mt-0.5 text-sm font-semibold sm:text-base", tone)}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 divide-y rounded-lg border">
              {MONITORS.map((m) => (
                <div key={m.name} className="flex items-center gap-3 px-2.5 py-2 sm:px-3">
                  <StatusDot state={m.state} />
                  <div className="w-28 min-w-0 shrink-0 sm:w-36">
                    <p className="flex items-center gap-1.5 truncate text-[12px] font-medium">
                      <MonitorTypeIcon type={m.type} className="size-3 text-muted-foreground" />
                      {m.name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{m.target}</p>
                  </div>
                  <Bars tones={m.bars} className="hidden min-w-0 flex-1 sm:flex" />
                  <div className="hidden w-16 shrink-0 md:block">
                    {m.spark.length ? (
                      <Sparkline
                        values={m.spark}
                        width={64}
                        height={20}
                        tone={m.state === "degraded" ? "text-warning" : "text-brand"}
                      />
                    ) : (
                      <span className="block text-center text-[10px] text-muted-foreground">on time</span>
                    )}
                  </div>
                  <span className="numeric ml-auto w-12 shrink-0 text-right text-[11px] text-muted-foreground sm:ml-0">
                    {m.latency}
                  </span>
                  <StatusBadge state={m.state} className="hidden h-5 px-2 text-[10px] min-[480px]:inline-flex" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating alert */}
      <div
        aria-hidden="true"
        className="absolute -bottom-5 right-3 hidden w-72 rounded-xl border bg-popover p-3 shadow-xs sm:block lg:-right-6"
      >
        <div className="flex items-start gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-success/10 text-success ring-1 ring-inset ring-success/20">
            <BellRing className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium">checkout is back up</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Down for <span className="numeric">4m 12s</span> with <span className="font-mono">HTTP 503</span>. Sent
              to Slack <span className="font-mono">#ops</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
