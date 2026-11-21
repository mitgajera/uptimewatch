import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, HelpCircle, Wrench, XCircle } from "lucide-react";
import { API_BACKEND_URL } from "@/config";
import type { PublicMonitorStatus, PublicPageStatus, PublicStatusPage } from "@/lib/api/types";
import { formatDuration, formatUptime } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";

// Matches the API's cache window.
export const revalidate = 60;

async function getStatusPage(slug: string): Promise<PublicStatusPage | null> {
  const res = await fetch(
    `${API_BACKEND_URL}/api/v1/public/status-pages/${encodeURIComponent(slug)}`,
    { next: { revalidate: 60 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Status page request failed (${res.status})`);
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStatusPage(slug).catch(() => null);
  return page
    ? { title: `${page.title} status`, description: page.description || `Current status of ${page.title}.` }
    : { title: "Status page not found" };
}

const BANNER: Record<PublicPageStatus, { text: string; icon: typeof CheckCircle2; className: string }> = {
  operational: {
    text: "All systems operational",
    icon: CheckCircle2,
    className: "border-success/40 bg-success/10 text-success",
  },
  maintenance: {
    text: "Scheduled maintenance in progress",
    icon: Wrench,
    className: "border-border bg-secondary text-foreground",
  },
  partial_outage: {
    text: "Some systems are down",
    icon: AlertTriangle,
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  major_outage: {
    text: "Major outage",
    icon: XCircle,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  unknown: {
    text: "Status not available yet",
    icon: HelpCircle,
    className: "border-border bg-muted text-muted-foreground",
  },
};

const MONITOR_LABEL: Record<PublicMonitorStatus, { text: string; className: string }> = {
  up: { text: "Operational", className: "text-success" },
  down: { text: "Down", className: "text-destructive" },
  maintenance: { text: "Under maintenance", className: "text-foreground" },
  paused: { text: "Paused", className: "text-muted-foreground" },
  unknown: { text: "No data", className: "text-muted-foreground" },
};

function barColor(uptime: number | null) {
  if (uptime == null) return "bg-muted";
  if (uptime >= 99.9) return "bg-success";
  if (uptime >= 95) return "bg-warning";
  return "bg-destructive";
}

export default async function PublicStatusPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getStatusPage(slug);
  if (!page) notFound();

  const banner = BANNER[page.status];
  const BannerIcon = banner.icon;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
        {page.description && <p className="text-muted-foreground">{page.description}</p>}
      </header>

      <div className={cn("flex items-center gap-3 rounded-lg border p-4 font-medium", banner.className)}>
        <BannerIcon className="size-5 shrink-0" aria-hidden="true" />
        {banner.text}
      </div>

      <section className="mt-8" aria-labelledby="services-heading">
        <h2 id="services-heading" className="sr-only">
          Services
        </h2>
        {page.monitors.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No services are listed on this page yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {page.monitors.map((m) => {
              const label = MONITOR_LABEL[m.status];
              return (
                <li key={m.id} className="space-y-3 p-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="truncate font-medium">{m.name}</h3>
                    <span className={cn("shrink-0 text-sm font-medium", label.className)}>{label.text}</span>
                  </div>
                  <div
                    className="flex h-8 items-stretch gap-px"
                    role="img"
                    aria-label={`${m.name}: ${formatUptime(m.uptime)} uptime over the last 90 days`}
                  >
                    {m.days.map((d, idx) => (
                      <span
                        key={d.date}
                        title={`${d.date}: ${d.uptime == null ? "no data" : `${d.uptime}% uptime`}`}
                        className={cn(
                          "flex-1 rounded-[2px]",
                          barColor(d.uptime),
                          // Phones show the last 30 days so bars stay readable.
                          idx < m.days.length - 30 && "hidden sm:block"
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      <span className="sm:hidden">30</span>
                      <span className="hidden sm:inline">90</span> days ago
                    </span>
                    <span className="tabular-nums">{formatUptime(m.uptime)} uptime</span>
                    <span>Today</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10 space-y-3" aria-labelledby="incidents-heading">
        <h2 id="incidents-heading" className="text-lg font-semibold">
          Recent incidents
        </h2>
        {page.incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incidents in the last 14 days.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {page.incidents.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 text-sm">
                <div>
                  <p className="font-medium">{i.monitor} was down</p>
                  <p className="text-muted-foreground">
                    <time dateTime={i.startedAt}>
                      {new Date(i.startedAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
                    </time>
                  </p>
                </div>
                <span className={i.ongoing ? "font-medium text-destructive" : "tabular-nums text-muted-foreground"}>
                  {i.ongoing ? "Ongoing" : `Resolved after ${formatDuration(i.durationMs)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Updated{" "}
          {new Date(page.generatedAt).toLocaleString("en", { timeStyle: "short", timeZone: "UTC" })} UTC
        </span>
        <Link href="/" className="hover:text-foreground">
          Powered by UptimeWatch
        </Link>
      </footer>
    </main>
  );
}
