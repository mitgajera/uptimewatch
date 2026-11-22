"use client";
/* eslint-disable @next/next/no-img-element -- Lighthouse returns the screenshot as a data URI */
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Gauge, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApiClient } from "@/hooks/useApiClient";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Segmented } from "../form/form-fields";

type Strategy = "desktop" | "mobile";

interface LighthouseAudit {
  displayValue?: string;
  numericValue?: number;
  score?: number | null;
  details?: { data?: string };
}
interface FieldMetric {
  percentile?: number;
  category?: string;
}
interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null } | undefined>;
    audits?: Record<string, LighthouseAudit | undefined>;
    fetchTime?: string;
    finalUrl?: string;
  };
  loadingExperience?: { metrics?: Record<string, FieldMetric | undefined>; overall_category?: string };
  originLoadingExperience?: { metrics?: Record<string, FieldMetric | undefined>; overall_category?: string };
}

const CATEGORIES = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "best-practices", label: "Best practices" },
  { key: "seo", label: "SEO" },
];

const LAB_METRICS = [
  { key: "first-contentful-paint", label: "First Contentful Paint", good: "≤ 1.8 s" },
  { key: "largest-contentful-paint", label: "Largest Contentful Paint", good: "≤ 2.5 s" },
  { key: "total-blocking-time", label: "Total Blocking Time", good: "≤ 200 ms" },
  { key: "cumulative-layout-shift", label: "Cumulative Layout Shift", good: "≤ 0.1" },
  { key: "speed-index", label: "Speed Index", good: "≤ 3.4 s" },
  { key: "server-response-time", label: "Server response time", good: "≤ 600 ms" },
];

const FIELD_METRICS = [
  { key: "LARGEST_CONTENTFUL_PAINT_MS", label: "LCP", unit: "s" },
  { key: "INTERACTION_TO_NEXT_PAINT", label: "INP", unit: "ms" },
  { key: "CUMULATIVE_LAYOUT_SHIFT_SCORE", label: "CLS", unit: "cls" },
  { key: "FIRST_CONTENTFUL_PAINT_MS", label: "FCP", unit: "s" },
  { key: "EXPERIMENTAL_TIME_TO_FIRST_BYTE", label: "TTFB", unit: "s" },
] as const;

function scoreTone(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 90) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

function categoryTone(category?: string) {
  if (category === "FAST" || category === "GOOD") return "text-success";
  if (category === "AVERAGE" || category === "NEEDS_IMPROVEMENT") return "text-warning";
  if (category === "SLOW" || category === "POOR") return "text-destructive";
  return "text-muted-foreground";
}

function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative size-16", scoreTone(score))}>
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
          />
        </svg>
        <span className="numeric absolute inset-0 grid place-items-center text-lg font-semibold">{score ?? "—"}</span>
      </div>
      <span className="text-center text-xs font-medium text-muted-foreground">{label}</span>
      <span className="sr-only">
        {label} score: {score ?? "not available"}
      </span>
    </div>
  );
}

function formatField(value: number | undefined, unit: "s" | "ms" | "cls") {
  if (value == null) return "—";
  if (unit === "cls") return (value / 100).toFixed(2);
  if (unit === "ms") return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function Report({ websiteId, url }: { websiteId: string; url: string }) {
  const api = useApiClient();
  const [strategy, setStrategy] = useState<Strategy>("mobile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PageSpeedResponse | null>(null);

  // Fetched through our API so the PageSpeed key never reaches the browser.
  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<PageSpeedResponse>(`/website/${websiteId}/pagespeed?strategy=${strategy}`, { timeout: 90_000 })
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(apiErrorMessage(err, "Couldn't run PageSpeed Insights.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, websiteId, strategy]);

  useEffect(() => run(), [run]);

  const reportLink = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}&form_factor=${strategy}`;
  const lr = data?.lighthouseResult;
  const audits = lr?.audits ?? {};
  const screenshot = audits["final-screenshot"]?.details?.data;
  const field = data?.loadingExperience?.metrics ?? data?.originLoadingExperience?.metrics;
  const fieldOverall = data?.loadingExperience?.overall_category ?? data?.originLoadingExperience?.overall_category;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Strategy>
          label="Device"
          size="sm"
          value={strategy}
          onChange={setStrategy}
          options={[
            { value: "mobile", label: "Mobile" },
            { value: "desktop", label: "Desktop" },
          ]}
        />
        <a
          href={reportLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Full report
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>

      {loading ? (
        <div className="grid place-items-center gap-3 py-16 text-center" role="status" aria-live="polite">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Running Lighthouse. This usually takes 15–30 seconds.</p>
        </div>
      ) : error ? (
        <div role="alert" className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={run}>
            <RotateCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-4">
              {CATEGORIES.map((c) => {
                const s = lr?.categories?.[c.key]?.score;
                return <ScoreRing key={c.key} label={c.label} score={s != null ? Math.round(s * 100) : null} />;
              })}
            </div>
            {screenshot && (
              <div className="grid place-items-center rounded-xl border bg-card p-3">
                <img src={screenshot} alt={`Screenshot of ${url} as rendered by Lighthouse`} className="max-h-40 rounded-md border" />
              </div>
            )}
          </div>

          <section aria-labelledby="ps-field" className="rounded-xl border bg-card">
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h3 id="ps-field" className="text-sm font-semibold">
                Real-user metrics (Core Web Vitals)
              </h3>
              {fieldOverall && (
                <span className={cn("text-xs font-medium capitalize", categoryTone(fieldOverall))}>
                  {fieldOverall.replace(/_/g, " ").toLowerCase()}
                </span>
              )}
            </header>
            {field ? (
              <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
                {FIELD_METRICS.map((m) => {
                  const metric = field[m.key];
                  return (
                    <div key={m.key} className="bg-card px-4 py-3">
                      <dt className="text-xs text-muted-foreground">{m.label}</dt>
                      <dd className={cn("numeric mt-1 text-lg font-semibold", categoryTone(metric?.category))}>
                        {formatField(metric?.percentile, m.unit)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Not enough real-user traffic for Chrome UX Report data.
              </p>
            )}
          </section>

          <section aria-labelledby="ps-lab" className="rounded-xl border bg-card">
            <header className="border-b px-4 py-3">
              <h3 id="ps-lab" className="text-sm font-semibold">
                Lab metrics
              </h3>
            </header>
            <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {LAB_METRICS.map((m) => {
                const audit = audits[m.key];
                const s = audit?.score;
                return (
                  <div key={m.key} className="bg-card px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{m.label}</dt>
                    <dd className="mt-1 flex items-baseline justify-between gap-2">
                      <span className={cn("numeric text-lg font-semibold", scoreTone(s != null ? Math.round(s * 100) : null))}>
                        {audit?.displayValue ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">Good {m.good}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <p className="text-center text-xs text-muted-foreground">
            Powered by Google PageSpeed Insights
            {lr?.fetchTime && <> · analyzed {new Date(lr.fetchTime).toLocaleString()}</>}
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Lighthouse report for an HTTP monitor, fetched through the API proxy. */
export function PageSpeedDialog({
  open,
  onOpenChange,
  websiteId,
  url,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  url: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="size-4 text-muted-foreground" aria-hidden="true" />
            PageSpeed Insights
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">{url}</DialogDescription>
        </DialogHeader>
        {open && <Report websiteId={websiteId} url={url} />}
      </DialogContent>
    </Dialog>
  );
}
