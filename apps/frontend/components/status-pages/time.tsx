"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { formatDuration, timeAgo } from "@/lib/monitor-format";

const subscribeNever = () => () => {};

/** False during SSR and hydration, true after; lets us render local time without a mismatch. */
function useHydrated() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
}

/** Current time, refreshed every `intervalMs`. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const STYLES = {
  datetime: { dateStyle: "medium", timeStyle: "short" },
  date: { dateStyle: "medium" },
  time: { timeStyle: "short" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * A timestamp in the viewer's timezone. The server render uses UTC (labelled),
 * then the client swaps in local time after hydration.
 */
export function LocalTime({
  iso,
  format = "datetime",
  className,
}: {
  iso: string;
  format?: keyof typeof STYLES;
  className?: string;
}) {
  const hydrated = useHydrated();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const text = hydrated
    ? date.toLocaleString(undefined, STYLES[format])
    : `${date.toLocaleString("en", { ...STYLES[format], timeZone: "UTC" })} UTC`;
  return (
    <time dateTime={iso} className={className} title={hydrated ? date.toISOString() : undefined}>
      {text}
    </time>
  );
}

/** "3 minutes ago", kept fresh. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const hydrated = useHydrated();
  const now = useNow(30_000);
  if (!hydrated) {
    return (
      <time dateTime={iso} className={className}>
        {new Date(iso).toLocaleString("en", { timeStyle: "short", timeZone: "UTC" })} UTC
      </time>
    );
  }
  return (
    <time dateTime={iso} className={className} title={new Date(iso).toLocaleString()}>
      {timeAgo(iso, now)}
    </time>
  );
}

/** Elapsed time since `since`, ticking every second (for ongoing incidents). */
export function LiveDuration({ since, className }: { since: string; className?: string }) {
  const now = useNow(1_000);
  // Server and client clocks differ by a few seconds; the text settles on the next tick.
  return (
    <span className={className} suppressHydrationWarning>
      {formatDuration(Math.max(0, now - new Date(since).getTime()))}
    </span>
  );
}
