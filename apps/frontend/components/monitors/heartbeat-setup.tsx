"use client";
import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { API_BACKEND_URL } from "@/config";
import { useRotateHeartbeatToken } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { Monitor } from "@/lib/api/types";
import { formatInterval, heartbeatUrl } from "@/lib/monitor-format";
import { copyText } from "@/lib/clipboard";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0"
      aria-label={copied ? "Copied" : label}
      onClick={() =>
        copyText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => toast.error("Could not copy to the clipboard")
        )
      }
    >
      {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </Button>
  );
}

/** Shows the ping URL and how to call it, plus token rotation. */
export function HeartbeatSetup({ monitor }: { monitor: Monitor }) {
  const rotate = useRotateHeartbeatToken(monitor.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const url = heartbeatUrl(API_BACKEND_URL, monitor.heartbeatToken);
  const cron = `curl -fsS -m 10 --retry 3 ${url} > /dev/null`;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid gap-1.5">
        <label htmlFor="heartbeat-url" className="text-sm font-medium">
          Ping URL
        </label>
        <div className="flex gap-2">
          <Input id="heartbeat-url" readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <CopyButton text={url} label="Copy ping URL" />
        </div>
        <p className="text-xs text-muted-foreground">
          Request this URL (any method) at the end of each successful run. If no ping arrives within{" "}
          {formatInterval(monitor.intervalSeconds)} plus {Math.round((monitor.graceSeconds ?? 300) / 60)} min grace, we
          alert you.
        </p>
      </div>

      <div className="grid gap-1.5">
        <p className="text-sm font-medium" id="heartbeat-example">
          Example: add to the end of a cron job
        </p>
        <div className="flex gap-2">
          <pre
            aria-labelledby="heartbeat-example"
            className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-xs"
          >
            <code>{`your-backup-script && ${cron}`}</code>
          </pre>
          <CopyButton text={cron} label="Copy curl command" />
        </div>
      </div>

      <Button type="button" variant="ghost" size="sm" className="-ml-3 h-10 text-muted-foreground" onClick={() => setConfirmOpen(true)}>
        <KeyRound className="size-4" aria-hidden="true" />
        Generate a new ping URL
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate a new ping URL?</AlertDialogTitle>
            <AlertDialogDescription>
              The current URL stops working immediately. Update every job that pings it, or the monitor will go down.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                rotate.mutate(undefined, {
                  onSuccess: () => toast.success("New ping URL generated"),
                  onError: (err) => toast.error(apiErrorMessage(err, "Could not generate a new URL.")),
                })
              }
            >
              Generate new URL
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
