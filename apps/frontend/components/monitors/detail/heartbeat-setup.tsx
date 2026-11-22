"use client";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
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
import { heartbeatUrl } from "@/lib/monitor-format";
import { intervalLabel } from "../form/form-model";
import { Segmented } from "../form/form-fields";
import { CopyButton } from "./copy-button";

type Example = "cron" | "shell" | "node" | "python";

function examples(url: string): Record<Example, { label: string; code: string }> {
  return {
    cron: {
      label: "Cron",
      code: `# Ping after the job succeeds\n0 2 * * * /usr/local/bin/backup.sh && curl -fsS -m 10 --retry 3 ${url} > /dev/null`,
    },
    shell: { label: "curl", code: `curl -fsS -m 10 --retry 3 ${url}` },
    node: { label: "Node.js", code: `await fetch("${url}", { method: "POST" });` },
    python: { label: "Python", code: `import urllib.request\nurllib.request.urlopen("${url}", timeout=10)` },
  };
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative min-w-0">
      <pre className="overflow-x-auto rounded-lg border bg-surface py-3 pl-3.5 pr-12 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} label={label} className="absolute right-1.5 top-1.5 bg-surface" />
    </div>
  );
}

/** Ping URL, ready-made snippets and token rotation for a heartbeat monitor. */
export function HeartbeatSetup({ monitor }: { monitor: Monitor }) {
  const rotate = useRotateHeartbeatToken(monitor.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [example, setExample] = useState<Example>("cron");
  const url = heartbeatUrl(API_BACKEND_URL, monitor.heartbeatToken);
  const snippets = examples(url);
  const graceMin = Math.round((monitor.graceSeconds ?? 0) / 60);

  return (
    <Panel
      title="Heartbeat setup"
      description={`Ping this URL when your job finishes. We alert if no ping arrives within ${intervalLabel(monitor.intervalSeconds)}${
        graceMin ? ` plus ${graceMin} min grace` : ""
      }.`}
      bodyClassName="grid gap-5 p-4"
    >
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground" id="ping-url-label">
          Ping URL · GET or POST
        </p>
        {url ? (
          <div className="flex min-w-0 items-center gap-1 rounded-lg border bg-surface py-1 pl-3 pr-1">
            <code aria-labelledby="ping-url-label" className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
              {url}
            </code>
            <CopyButton text={url} label="Copy ping URL" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No ping URL yet. Generate one below.</p>
        )}
      </div>

      {url && (
        <div className="grid gap-2">
          <Segmented<Example>
            label="Example"
            size="sm"
            value={example}
            onChange={setExample}
            options={(Object.keys(snippets) as Example[]).map((k) => ({ value: k, label: snippets[k].label }))}
          />
          <CodeBlock code={snippets[example].code} label={`Copy ${snippets[example].label} example`} />
        </div>
      )}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Leaked the URL? Generate a new one; the old one stops working.</p>
        <Button variant="outline" className="h-9 shrink-0" onClick={() => setConfirmOpen(true)} disabled={rotate.isPending}>
          {rotate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
          Rotate token
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !rotate.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate a new ping URL?</AlertDialogTitle>
            <AlertDialogDescription>
              The current URL stops working immediately. Update every job that pings it, or this monitor will go down.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotate.isPending}>Cancel</AlertDialogCancel>
            <Button
              onClick={() =>
                rotate.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("New ping URL generated", { description: "Update your jobs with the new URL." });
                    setConfirmOpen(false);
                  },
                  onError: (err) => toast.error(apiErrorMessage(err, "Couldn't generate a new URL.")),
                })
              }
              disabled={rotate.isPending}
              aria-busy={rotate.isPending}
            >
              {rotate.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Generate new URL
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
