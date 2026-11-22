"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  Gauge,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { MonitorTypeIcon, StatusBadge } from "@/components/app/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCheckNow, useCsvDownload, useUpdateMonitor, type MonitorUpdate } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { Monitor } from "@/lib/api/types";
import { displayName, errorLabel, formatLatency, monitorState, monitorTarget, TYPE_LABEL } from "@/lib/monitor-format";
import { intervalLabel } from "../form/form-model";
import { DeleteMonitorDialog } from "../delete-monitor-dialog";
import { CopyButton } from "./copy-button";
import { PageSpeedDialog } from "./pagespeed-dialog";

const MAINTENANCE = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "24 hours", minutes: 1440 },
];

/** Hook for the PATCH actions shared by the header and the banners. */
export function useMonitorActions(monitor: Monitor) {
  const update = useUpdateMonitor(monitor.id);
  const run = (input: MonitorUpdate, success: string, failure: string) =>
    update.mutate(input, {
      onSuccess: () => toast.success(success),
      onError: (err) => toast.error(apiErrorMessage(err, failure)),
    });
  const name = displayName(monitor);
  return {
    pending: update.isPending,
    pause: () => run({ paused: true }, `${name} paused`, "Couldn't pause the monitor."),
    resume: () => run({ paused: false }, `${name} resumed`, "Couldn't resume the monitor."),
    startMaintenance: (minutes: number, label: string) =>
      run({ maintenanceMinutes: minutes }, `Maintenance started for ${label}`, "Couldn't start maintenance."),
    endMaintenance: () => run({ maintenanceUntil: null }, "Maintenance ended", "Couldn't end maintenance."),
  };
}

export function MonitorHeader({ monitor: m }: { monitor: Monitor }) {
  const router = useRouter();
  const actions = useMonitorActions(m);
  const checkNow = useCheckNow(m.id);
  const download = useCsvDownload();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const state = monitorState(m);
  const name = displayName(m);
  const isHttp = m.type === "http";
  const isHeartbeat = m.type === "heartbeat";
  const inMaintenance = state === "maintenance";
  const target = isHttp ? m.url : monitorTarget(m);

  function runCheck() {
    checkNow.mutate(undefined, {
      onSuccess: (r) => {
        const parts = [
          r.statusCode != null ? `HTTP ${r.statusCode}` : null,
          r.latency > 0 ? formatLatency(r.latency) : null,
        ].filter(Boolean);
        if (r.status === "UP") {
          toast.success(`${name} is up`, { description: parts.join(" · ") || "Check passed" });
        } else {
          toast.error(`${name} is down — ${errorLabel(r.errorType)}`, {
            description: [parts.join(" · "), r.errorMessage].filter(Boolean).join(" — ") || undefined,
          });
        }
      },
      onError: (err) => toast.error(apiErrorMessage(err, "Couldn't run the check.")),
    });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "monitor";
      await download(`/website/${m.id}/export.csv?range=30d`, `${slug}-checks-30d.csv`);
      toast.success("Export downloaded", { description: "Checks from the last 30 days." });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't export checks."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground shadow-xs">
          <MonitorTypeIcon type={m.type} className="size-5" />
        </span>
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl">{name}</h1>
            <StatusBadge state={state} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="sr-only">{TYPE_LABEL[m.type]} monitor for </span>
            <span className="flex min-w-0 max-w-full items-center">
              {isHttp && (
                <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                  {m.method}
                </span>
              )}
              {isHttp ? (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 rounded font-mono text-xs underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                >
                  <span className="truncate">{target}</span>
                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span className={isHeartbeat ? "truncate" : "truncate font-mono text-xs sm:text-sm"}>{target}</span>
              )}
              {!isHeartbeat && <CopyButton text={target} label="Copy target" className="-my-2 ml-0.5" />}
            </span>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span>{isHeartbeat ? `Every ${intervalLabel(m.intervalSeconds)}` : `Checked every ${intervalLabel(m.intervalSeconds)}`}</span>
          </div>
          {m.tags?.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Tags">
              {m.tags.map((t) => (
                <li key={t}>
                  <Link
                    href={`/dashboard/monitors?tags=${encodeURIComponent(t)}`}
                    className="inline-flex h-6 items-center rounded-md border bg-surface px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!isHeartbeat && (
          <Button
            variant="outline"
            onClick={runCheck}
            disabled={checkNow.isPending || m.paused}
            aria-busy={checkNow.isPending}
            title={m.paused ? "Resume the monitor to run checks" : undefined}
          >
            {checkNow.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {checkNow.isPending ? "Checking…" : "Check now"}
          </Button>
        )}

        {m.paused ? (
          <Button variant="outline" onClick={actions.resume} disabled={actions.pending}>
            <Play aria-hidden="true" />
            Resume
          </Button>
        ) : (
          <Button variant="outline" onClick={actions.pause} disabled={actions.pending}>
            <Pause aria-hidden="true" />
            Pause
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={actions.pending || m.paused}>
              <Wrench aria-hidden="true" />
              <span className="hidden sm:inline">Maintenance</span>
              <span className="sr-only sm:hidden">Maintenance</span>
              <ChevronDown className="opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {inMaintenance ? "Extend maintenance from now" : "Mute alerts and pause uptime for"}
            </DropdownMenuLabel>
            {MAINTENANCE.map((d) => (
              <DropdownMenuItem key={d.minutes} onSelect={() => actions.startMaintenance(d.minutes, d.label)}>
                {d.label}
              </DropdownMenuItem>
            ))}
            {inMaintenance && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={actions.endMaintenance}>End maintenance now</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button asChild>
          <Link href={`/dashboard/monitors/${m.id}/edit`}>
            <Pencil aria-hidden="true" />
            Edit
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
              Export checks (CSV)
            </DropdownMenuItem>
            {isHttp && (
              <DropdownMenuItem onSelect={() => setSpeedOpen(true)}>
                <Gauge aria-hidden="true" />
                PageSpeed report
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteOpen(true)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 aria-hidden="true" />
              Delete monitor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteMonitorDialog
        monitorId={m.id}
        name={name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/dashboard/monitors")}
      />
      {isHttp && <PageSpeedDialog open={speedOpen} onOpenChange={setSpeedOpen} websiteId={m.id} url={m.url} />}
    </header>
  );
}
