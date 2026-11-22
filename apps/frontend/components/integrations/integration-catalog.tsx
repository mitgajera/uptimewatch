"use client";

import { ArrowUpRight, Check } from "lucide-react";
import type { AlertChannel, AlertChannelType } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { INTEGRATIONS, INTEGRATION_ORDER, MAX_CHANNELS } from "./catalog";
import { IntegrationIcon } from "./integration-icon";

export function IntegrationCatalog({
  channels,
  onSelect,
  id,
}: {
  channels: AlertChannel[] | undefined;
  onSelect: (type: AlertChannelType) => void;
  id?: string;
}) {
  const atLimit = (channels?.length ?? 0) >= MAX_CHANNELS;
  const countByType = (t: AlertChannelType) => channels?.filter((c) => c.type === t).length ?? 0;

  return (
    <section id={id} aria-labelledby="catalog-heading" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="catalog-heading" className="text-sm font-semibold">
            Add an integration
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Up to <span className="numeric">{MAX_CHANNELS}</span> channels per account. You can add the same type more
            than once.
          </p>
        </div>
        {atLimit && (
          <p role="status" className="text-xs font-medium text-warning">
            Limit reached — delete a channel to add another.
          </p>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {INTEGRATION_ORDER.map((type) => {
          const meta = INTEGRATIONS[type];
          const count = countByType(type);
          return (
            <li key={type}>
              <button
                type="button"
                disabled={atLimit}
                onClick={() => onSelect(type)}
                className={cn(
                  "group flex h-full w-full flex-col rounded-xl border bg-card p-4 text-left shadow-xs transition-colors duration-150",
                  "hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card"
                )}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <IntegrationIcon type={type} />
                  {count > 0 ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success/10 px-2 text-[11px] font-medium text-success ring-1 ring-inset ring-success/20">
                      <Check className="size-3" aria-hidden="true" />
                      <span className="numeric">{count}</span> connected
                    </span>
                  ) : (
                    <ArrowUpRight
                      className="size-4 text-muted-foreground/60 transition-colors group-hover:text-foreground"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="mt-3 text-sm font-medium">{meta.label}</span>
                <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.blurb}</span>
                <span className="sr-only">. Connect {meta.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
