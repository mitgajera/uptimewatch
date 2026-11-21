/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState, useCallback } from 'react';
import { useApiClient } from '@/hooks/useApiClient';
import { apiErrorMessage } from '@/lib/api/errors';
import { toast } from 'sonner';

interface PageSpeedInsightsModalProps {
  websiteId: string;
  url: string;
}

// color helpers
function getScoreColor(score: number | null | undefined) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 90) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}
function getStatusColor(status: string) {
  if (status === 'GOOD') return 'text-success';
  if (status === 'NEEDS_IMPROVEMENT') return 'text-warning';
  if (status === 'POOR') return 'text-destructive';
  return 'text-muted-foreground';
}

const METRIC_LABELS: Record<string, { label: string; good: string; unit?: string }> = {
  'first-contentful-paint':    { label: 'First Contentful Paint',    good: '≤ 1.8s', unit: 's' },
  'largest-contentful-paint': { label: 'Largest Contentful Paint',   good: '≤ 2.5s', unit: 's' },
  'speed-index':              { label: 'Speed Index',                 good: '≤ 3.4s', unit: 's' },
  'total-blocking-time':      { label: 'Total Blocking Time',         good: '≤ 200ms', unit: 'ms' },
  'cumulative-layout-shift':  { label: 'Cumulative Layout Shift',     good: '≤ 0.1' },
  'interactive':              { label: 'Time to Interactive',          good: '≤ 3.8s', unit: 's' },
  'server-response-time':     { label: 'Time to First Byte',          good: '≤ 0.2s', unit: 'ms' },
};

// Minimal types for API response
interface LighthouseCategory { score?: number; title?: string; }
interface LighthouseAudit { id?: string; title?: string; displayValue?: string; numericValue?: number; score?: number; details?: { data?: string }; }
interface LighthouseResult {
  categories?: {
    performance?: LighthouseCategory;
    accessibility?: LighthouseCategory;
    'best-practices'?: LighthouseCategory;
    seo?: LighthouseCategory;
    [key: string]: LighthouseCategory | undefined;
  };
  audits?: Record<string, LighthouseAudit>;
  fetchTime?: string;
  configSettings?: { formFactor?: string };
  finalUrl?: string;
}
interface PageSpeedApiMetrics {
  [key: string]: {
    percentile?: number;
    category?: string;
    [k: string]: unknown;
  };
}
interface PageSpeedApiResponse {
  lighthouseResult?: LighthouseResult;
  loadingExperience?: {
    metrics?: PageSpeedApiMetrics;
    overall_category?: string;
  };
  originLoadingExperience?: {
    metrics?: PageSpeedApiMetrics;
    overall_category?: string;
  };
}

export function PageSpeedInsightsModal({ websiteId, url }: PageSpeedInsightsModalProps) {
  const api = useApiClient();
  const [strategy, setStrategy] = useState<'desktop'|'mobile'>('desktop');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string|null>(null);
  const [data, setData]         = useState<PageSpeedApiResponse|null>(null);

  const reportLink = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}&strategy=${strategy}`;

  // Fetched through our API so the PageSpeed key never reaches the browser.
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    setData(null);
    api
      .get<PageSpeedApiResponse>(`/website/${websiteId}/pagespeed?strategy=${strategy}`, {
        timeout: 90_000,
      })
      .then(res => setData(res.data))
      .catch(err => setError(apiErrorMessage(err, 'Could not run PageSpeed Insights.')))
      .finally(() => setLoading(false));
  }, [api, websiteId, strategy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
        Running Lighthouse… this usually takes 15–30 seconds.
      </div>
    );
  if (error)
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center text-sm text-destructive">
        {error}
        <button
          onClick={fetchData}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retry
        </button>
      </div>
    );
  if (!data) return null;

  const lr         = data.lighthouseResult;
  const cats       = lr?.categories || {};
  const perf       = cats.performance;
  const acc        = cats.accessibility;
  const bp         = cats['best-practices'];
  const seo        = cats.seo;
  const audits     = lr?.audits || {};
  const screenshot = audits['final-screenshot']?.details?.data;
  const field      = data.loadingExperience?.metrics || data.originLoadingExperience?.metrics;
  const cwv        = field && {
    LCP:  field.LARGEST_CONTENTFUL_PAINT_MS,
    FCP:  field.FIRST_CONTENTFUL_PAINT_MS,
    CLS:  field.CUMULATIVE_LAYOUT_SHIFT_SCORE,
    INP:  field.INTERACTION_TO_NEXT_PAINT,
    TTFB: field.EXPERIMENTAL_TIME_TO_FIRST_BYTE,
  };
  const cwvStatus  = data.loadingExperience?.overall_category
                  || data.originLoadingExperience?.overall_category;
  const labMetrics: Record<string, LighthouseAudit | undefined> = {
    'first-contentful-paint':    audits['first-contentful-paint'],
    'largest-contentful-paint':  audits['largest-contentful-paint'],
    'speed-index':               audits['speed-index'],
    'total-blocking-time':       audits['total-blocking-time'],
    'cumulative-layout-shift':   audits['cumulative-layout-shift'],
    interactive:                 audits.interactive,
    'server-response-time':      audits['server-response-time'],
  };
  const fetchTime  = lr?.fetchTime;
  const device     = lr?.configSettings?.formFactor || 'desktop';
  const pageTitle  = lr?.finalUrl || url;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}`;

  return (
    <div className="w-full h-full max-w-full max-h-full overflow-y-auto bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b px-4 pr-14 sm:px-8 sm:pr-16 py-4 flex flex-wrap items-center gap-3">
        <img src={faviconUrl} alt="" className="w-8 h-8 rounded" />
        <div className="flex-1 min-w-0">
          <div className="truncate font-semibold text-lg text-foreground">
            {pageTitle}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            Last analyzed: {fetchTime ? new Date(fetchTime).toLocaleString() : 'N/A'} • Device: {device.charAt(0).toUpperCase()+device.slice(1)}
          </div>
        </div>
        <a
          href={reportLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Full report
        </a>
        <button
          onClick={() =>
            navigator.clipboard
              .writeText(reportLink)
              .then(() => toast.success('Link copied'), () => toast.error('Could not copy the link'))
          }
          className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Copy link
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-8">
        {/* Strategy selector */}
        <div>
          <label htmlFor="strategy" className="mr-2 text-xs text-muted-foreground">
            Strategy:
          </label>
          <select
            id="strategy"
            value={strategy}
            onChange={e => setStrategy(e.target.value as 'desktop' | 'mobile')}
            className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>

        {/* Scorecard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-card rounded-xl p-6 flex flex-col gap-6 border">
            <h3 className="text-xl font-bold mb-2 text-foreground">
              Overall Health Scorecard
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Performance', key: perf },
                { label: 'SEO', key: seo },
                { label: 'Accessibility', key: acc },
                { label: 'Best Practices', key: bp },
              ].map(({ label, key }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-xs text-muted-foreground mb-1">
                    {label}
                  </span>
                  <span
                    className={`text-4xl font-extrabold ${
                      getScoreColor(key?.score ? Math.round(key.score * 100) : null)
                    }`}
                  >
                    {key?.score != null ? Math.round(key.score * 100) : 'N/A'}
                  </span>
                  <span className="text-xs text-muted-foreground">Good: 90-100</span>
                </div>
              ))}
            </div>
          </div>
          {screenshot && (
            <div className="bg-card rounded-xl p-6 flex flex-col items-center border">
              <img
                src={screenshot}
                alt="Website Screenshot"
                className="rounded-lg border max-w-full max-h-60 mb-2"
              />
              <span className="text-xs text-muted-foreground">Website Screenshot</span>
            </div>
          )}
        </div>

        {/* Core Web Vitals */}
        <div className="bg-card rounded-xl p-6 border">
          <h4 className="font-semibold text-lg mb-4 text-foreground">
            Core Web Vitals Status
          </h4>
          {cwv ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 mb-2">
              {Object.entries(cwv).map(([key, metric]) => (
                metric && (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground mb-1 font-medium">
                      {key}
                    </span>
                    <span className={`text-2xl font-bold ${getStatusColor(String(metric.category))}`}>
                      {metric.percentile
                        ? (key === 'CLS'
                          ? (metric.percentile / 100).toFixed(2)
                          : (metric.percentile / 1000).toFixed(2) + 's')
                        : 'N/A'}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {metric.category?.replace('_', ' ').toLowerCase() || ''}
                    </span>
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Loading experience metrics are unavailable.
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            Overall:{' '}
            <span className={getStatusColor(String(cwvStatus))}>
              {String(cwvStatus).replace('_', ' ').toLowerCase()}
            </span>
          </div>
        </div>

        {/* Lab Metrics */}
        <div className="bg-card rounded-xl p-6 border">
          <h4 className="font-semibold text-lg mb-4 text-foreground">
            Key Lab Performance Metrics
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Object.entries(METRIC_LABELS).map(([key, { label, good, unit }]) => {
              const metric = labMetrics[key];
              let value = metric?.displayValue || metric?.numericValue;
              if (typeof value === 'number') {
                if (unit === 's') value = (value / 1000).toFixed(2) + 's';
                else if (unit === 'ms') value = Math.round(value) + 'ms';
                else value = value.toString();
              }
              return (
                <div
                  key={key}
                  className="flex flex-col gap-1 items-center bg-muted rounded-lg p-4 border"
                >
                  <span className="text-xs text-muted-foreground font-medium">
                    {label}
                  </span>
                  <span className={`text-xl font-bold ${getScoreColor(metric?.score ? Math.round(metric.score * 100) : null)}`}>
                    {value || 'N/A'}
                  </span>
                  <span className="text-xs text-muted-foreground">Good: {good}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          Powered by Google PageSpeed Insights
        </div>
      </div>
    </div>
  );
}
