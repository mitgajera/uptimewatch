import Link from "next/link";
import { CheckCircle2, Megaphone } from "lucide-react";
import type { PublicStatusPage } from "@/lib/api/types";
import { LogoMark } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { accentValue } from "./status-meta";
import { OverallBanner } from "./overall-banner";
import { MonitorStatusRow, UptimeLegend } from "./monitor-status-row";
import { PublicIncidentCard } from "./public-incident";

/**
 * The public status page design. Pure (no hooks), so it renders on the server for
 * `/status/[slug]` and on the client for the dashboard's live preview.
 * Sizing uses container queries, so the preview adapts to its column like a phone would.
 */
export function PublicStatusView({
  page,
  preview = false,
  className,
}: {
  page: PublicStatusPage;
  /** Dashboard preview: no full-height layout and no outbound links. */
  preview?: boolean;
  className?: string;
}) {
  const incidents = [...page.incidents].sort((a, b) => Number(b.ongoing) - Number(a.ongoing));
  const upCount = page.monitors.filter((m) => m.status === "up").length;
  const announcement = page.announcement?.trim();

  return (
    <div
      className={cn("@container relative bg-background text-foreground", !preview && "min-h-dvh", className)}
      style={{ "--status-accent": accentValue(page.accentColor) } as React.CSSProperties}
    >
      <div className="h-1 w-full bg-[var(--status-accent)]" aria-hidden="true" />
      <div
        className={cn(
          "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 @lg:gap-8 @lg:px-6",
          preview ? "py-6 @lg:py-8" : "py-10 @lg:py-16"
        )}
      >
        <header className="flex items-center gap-3.5">
          <PageLogo title={page.title} logoUrl={page.logoUrl} />
          <div className="min-w-0">
            {preview ? (
              <p className="truncate text-xl font-semibold tracking-tight @lg:text-2xl">{page.title || "Untitled page"}</p>
            ) : (
              <h1 className="truncate font-serif text-2xl tracking-tight @lg:text-3xl">{page.title}</h1>
            )}
            {page.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{page.description}</p>
            )}
          </div>
        </header>

        <OverallBanner
          status={page.status}
          generatedAt={page.generatedAt}
          upCount={upCount}
          total={page.monitors.length}
        />

        {announcement && (
          <aside
            aria-label="Announcement"
            className="flex gap-3 rounded-xl border border-l-[3px] border-l-[var(--status-accent)] bg-card p-4 shadow-xs"
          >
            <Megaphone className="mt-0.5 size-4 shrink-0 text-[var(--status-accent)]" aria-hidden="true" />
            <p className="min-w-0 text-sm leading-relaxed break-words whitespace-pre-line">{announcement}</p>
          </aside>
        )}

        <section aria-labelledby={preview ? undefined : "services-heading"} className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h2 id={preview ? undefined : "services-heading"} className="text-sm font-semibold">
              Services
            </h2>
            <UptimeLegend />
          </div>
          {page.monitors.length === 0 ? (
            <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              No services are listed on this page yet.
            </p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
              {page.monitors.map((m) => (
                <MonitorStatusRow key={m.id} monitor={m} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={preview ? undefined : "incidents-heading"} className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <h2 id={preview ? undefined : "incidents-heading"} className="text-sm font-semibold">
              Incidents
            </h2>
            <p className="text-xs text-muted-foreground">Past 14 days</p>
          </div>
          {incidents.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-5 text-sm text-muted-foreground shadow-xs">
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
              No incidents reported recently.
            </div>
          ) : (
            <ol className="space-y-3">
              {incidents.map((i) => (
                <li key={i.id}>
                  <PublicIncidentCard incident={i} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="flex items-center justify-center border-t pt-6">
          {preview ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <LogoMark className="size-5 rounded-md [&_svg]:size-3" />
              Powered by UptimeWatch
            </span>
          ) : (
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <LogoMark className="size-5 rounded-md [&_svg]:size-3" />
              Powered by <span className="font-medium text-foreground">UptimeWatch</span>
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}

function PageLogo({ title, logoUrl }: { title: string; logoUrl?: string }) {
  if (logoUrl && /^https:\/\//i.test(logoUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary external logo, no loader configured
      <img
        src={logoUrl}
        alt={`${title} logo`}
        className="size-11 shrink-0 rounded-xl border bg-card object-contain p-1 shadow-xs"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--status-accent)_14%,transparent)] text-lg font-semibold text-[var(--status-accent)] ring-1 ring-[color-mix(in_oklch,var(--status-accent)_30%,transparent)] ring-inset"
    >
      {(title.trim()[0] ?? "S").toUpperCase()}
    </span>
  );
}
