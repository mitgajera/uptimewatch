"use client";
import Link from "next/link";
import { BadgeCheck, ExternalLink, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusDot } from "@/components/app/status";
import type { Monitor, PublicMonitorStatus, StatusPage } from "@/lib/api/types";
import { displayName, timeAgo } from "@/lib/monitor-format";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { accentValue, MONITOR_STATUS, OVERALL, overallStatus } from "./status-meta";
import { toPublicStatus } from "./preview-data";

const SEGMENT: Record<PublicMonitorStatus, string> = {
  up: "bg-success/85",
  down: "bg-destructive/85",
  maintenance: "bg-info/85",
  paused: "bg-muted-foreground/30",
  unknown: "bg-muted",
};

export function StatusPageCard({
  page,
  monitors,
  onBadge,
  onDelete,
}: {
  page: StatusPage;
  /** The user's monitors, or undefined while loading. */
  monitors: Monitor[] | undefined;
  onBadge: () => void;
  onDelete: () => void;
}) {
  const href = `/status/${page.slug}`;
  const editHref = `/dashboard/status-pages/${page.id}`;
  const byId = new Map((monitors ?? []).map((m) => [m.id, m]));
  const shown = page.websiteIds.map((id) => byId.get(id)).filter((m): m is Monitor => Boolean(m));
  const statuses = shown.map((m) => toPublicStatus(m));
  const overall = OVERALL[overallStatus(statuses)];
  const count = page.websiteIds.length;

  async function copyLink() {
    try {
      await copyText(`${window.location.origin}${href}`);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy to the clipboard");
    }
  }

  return (
    <article
      className="group relative flex w-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-colors hover:border-foreground/15"
      style={{ "--status-accent": accentValue(page.accentColor) } as React.CSSProperties}
    >
      <div className="h-1 bg-[var(--status-accent)]" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklch,var(--status-accent)_14%,transparent)] text-sm font-semibold text-[var(--status-accent)]"
          >
            {(page.title.trim()[0] ?? "S").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 truncate text-sm font-semibold">
                <Link
                  href={editHref}
                  className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {page.title}
                </Link>
              </h2>
              {page.published ? (
                <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-success/10 px-2 text-[11px] font-medium text-success ring-1 ring-success/20 ring-inset">
                  Published
                </span>
              ) : (
                <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground ring-1 ring-border ring-inset">
                  Draft
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{href}</p>
          </div>
        </div>

        {/* Mini preview of what visitors see right now. */}
        <div className="rounded-lg border bg-surface/60 p-3">
          {monitors === undefined ? (
            <div className="h-10 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs font-medium">
                <StatusDot state={overall.dot} live={false} />
                <span className={overall.tone}>{count === 0 ? "No monitors yet" : overall.title}</span>
              </div>
              <div className="mt-2.5 flex h-4 gap-[3px]" aria-hidden="true">
                {count === 0 ? (
                  <span className="flex-1 rounded-[3px] bg-muted" />
                ) : (
                  shown.map((m, idx) => (
                    <Tooltip key={m.id}>
                      <TooltipTrigger asChild>
                        <span className={cn("relative z-10 flex-1 rounded-[3px]", SEGMENT[statuses[idx]])} />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        {displayName(m)} · {MONITOR_STATUS[statuses[idx]].label}
                      </TooltipContent>
                    </Tooltip>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-auto text-xs text-muted-foreground">
          <span className="numeric">{count}</span> monitor{count === 1 ? "" : "s"} · Updated{" "}
          <span className="numeric">{timeAgo(page.updatedAt)}</span>
        </p>
      </div>

      <div className="relative z-10 flex items-center gap-1 border-t px-2 py-1.5">
        {page.published ? (
          <Button variant="ghost" size="sm" className="h-9" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
              Open
              <span className="sr-only"> {page.title} public page (opens in a new tab)</span>
            </a>
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <Button variant="ghost" size="sm" className="pointer-events-none h-9" disabled>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Open
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Publish the page to open it</TooltipContent>
          </Tooltip>
        )}
        <Button variant="ghost" size="sm" className="h-9" asChild>
          <Link href={editHref}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
            <span className="sr-only"> {page.title}</span>
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto size-9" aria-label={`More actions for ${page.title}`}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={copyLink}>
              <Link2 className="size-4" aria-hidden="true" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onBadge}>
              <BadgeCheck className="size-4" aria-hidden="true" />
              Badge embed
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
