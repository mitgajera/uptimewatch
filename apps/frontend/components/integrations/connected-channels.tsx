"use client";

import { BellOff, Inbox, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlertChannel } from "@/lib/api/types";
import { MAX_CHANNELS } from "./catalog";
import { ChannelRow } from "./channel-row";

export function ConnectedChannels({
  channels,
  isLoading,
  isError,
  onRetry,
  onBrowse,
}: {
  channels: AlertChannel[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onBrowse: () => void;
}) {
  const enabled = channels?.filter((c) => c.enabled).length ?? 0;
  const total = channels?.length ?? 0;
  const allPaused = total > 0 && enabled === 0;

  return (
    <section aria-labelledby="connected-heading" className="rounded-xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 id="connected-heading" className="text-sm font-semibold">
            Connected
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isLoading ? (
              "Loading channels…"
            ) : (
              <>
                <span className="numeric">{enabled}</span> of <span className="numeric">{total}</span> enabled
              </>
            )}
          </p>
        </div>
        {!isLoading && !isError && (
          <span className="numeric text-xs text-muted-foreground">
            {total}/{MAX_CHANNELS} channels used
          </span>
        )}
      </header>

      {allPaused && (
        <div
          role="status"
          className="flex items-start gap-2 border-b bg-warning/10 px-4 py-2.5 text-sm text-warning"
        >
          <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Every channel is off, so alerts are paused. Turn one back on to get notified when a monitor goes down.
          </p>
        </div>
      )}

      {isLoading ? (
        <ul aria-hidden="true" className="divide-y">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="hidden h-9 w-24 sm:block" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load your integrations</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" className="mt-4 h-9" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-full border bg-background shadow-xs">
            <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-semibold">No integrations yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Alerts go to your account email for now. Connect Slack, Telegram or another channel to reach your team where
            they work.
          </p>
          <Button className="mt-5 h-9" onClick={onBrowse}>
            Add an integration
          </Button>
        </div>
      ) : (
        <ul className="divide-y">
          {channels!.map((c) => (
            <ChannelRow key={c.id} channel={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
