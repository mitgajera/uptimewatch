"use client";
import { BellRing, Clock, ShieldCheck, Target } from "lucide-react";
import { MonitorTypeIcon } from "@/components/app/status";
import type { AlertChannel } from "@/lib/api/types";
import { formatInterval } from "@/lib/monitor-format";
import { BODY_METHODS, intervalLabel, REMINDER_LABEL, STATUS_PRESETS, type FormState } from "./form-model";
import { TYPE_META } from "./type-picker";

function Row({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="text-sm leading-relaxed text-foreground">{children}</div>
      </div>
    </div>
  );
}

const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="break-all rounded bg-muted px-1 py-px font-mono text-[12px]">{children}</span>
);

function target(f: FormState) {
  switch (f.type) {
    case "http":
      return f.url.trim() ? (
        <>
          <span className="font-mono text-xs font-semibold">{f.method}</span> <Mono>{f.url.trim()}</Mono>
          {f.headers.length > 0 && (
            <span className="text-muted-foreground">
              {" "}
              with <span className="numeric">{f.headers.length}</span> header{f.headers.length === 1 ? "" : "s"}
            </span>
          )}
          {BODY_METHODS.includes(f.method) && f.body.trim() && <span className="text-muted-foreground"> and a body</span>}
        </>
      ) : (
        <span className="text-muted-foreground">Enter a URL to check</span>
      );
    case "tcp":
      return f.host.trim() ? (
        <>
          Open a TCP connection to <Mono>{`${f.host.trim()}:${f.port || "?"}`}</Mono>
        </>
      ) : (
        <span className="text-muted-foreground">Enter a host and port</span>
      );
    case "dns":
      return f.host.trim() ? (
        <>
          Resolve the <span className="font-mono text-xs font-semibold">{f.dnsRecordType}</span> record for{" "}
          <Mono>{f.host.trim()}</Mono>
        </>
      ) : (
        <span className="text-muted-foreground">Enter a hostname to resolve</span>
      );
    case "heartbeat":
      return <>Your job requests a private ping URL each time it finishes.</>;
  }
}

function healthy(f: FormState) {
  if (f.type === "heartbeat") return null;
  const parts: React.ReactNode[] = [];
  if (f.type === "http") {
    const expected = STATUS_PRESETS.find((p) => p.value === f.statusPreset)?.expected ?? (f.expectedStatus || "…");
    parts.push(
      <span key="status">
        the status is <Mono>{expected}</Mono>
      </span>
    );
    if (f.keyword.trim()) {
      parts.push(
        <span key="kw">
          the body {f.keywordMode === "absent" ? "doesn't contain" : "contains"} <Mono>{f.keyword.trim()}</Mono>
        </span>
      );
    }
  }
  if (f.type === "tcp") parts.push(<span key="tcp">the port accepts connections</span>);
  if (f.type === "dns") {
    parts.push(
      f.dnsExpected.trim() ? (
        <span key="dns">
          a record contains <Mono>{f.dnsExpected.trim()}</Mono>
        </span>
      ) : (
        <span key="dns">any record is returned</span>
      )
    );
  }
  return (
    <>
      Up when{" "}
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " and "}
          {p}
        </span>
      ))}
      {(f.type === "http" || f.type === "tcp") && f.degradedEnabled && Number(f.degradedMs) > 0 && (
        <>
          . Degraded when slower than <span className="numeric">{Number(f.degradedMs).toLocaleString()}</span> ms
        </>
      )}
      .
    </>
  );
}

export function MonitorSummary({ form, channels }: { form: FormState; channels: AlertChannel[] | undefined }) {
  const f = form;
  const enabled = (channels ?? []).filter((c) => c.enabled);
  const selected = (channels ?? []).filter((c) => f.alertChannelIds.includes(c.id));
  const grace = Number(f.graceMinutes);

  const recipients =
    f.alertMode === "all"
      ? enabled.length
        ? `all ${enabled.length} enabled channel${enabled.length === 1 ? "" : "s"}`
        : "your channels (none are set up yet)"
      : selected.length
        ? selected.map((c) => c.name).join(", ")
        : "no channels yet";

  const detectMinutes = (f.intervalSeconds * f.failureThreshold) / 60;

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md border bg-surface">
          <MonitorTypeIcon type={f.type} className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{f.name.trim() || "Untitled monitor"}</p>
          <p className="text-xs text-muted-foreground">{TYPE_META[f.type].title} monitor</p>
        </div>
      </div>
      <div className="grid gap-4 p-4" aria-live="polite">
        <Row icon={Target} title="What we check">
          {target(f)}
        </Row>
        {f.type === "heartbeat" ? (
          <Row icon={Clock} title="How often">
            Expect a ping every <span className="numeric">{intervalLabel(f.intervalSeconds)}</span>
            {Number.isFinite(grace) && grace > 0 ? (
              <>
                , with <span className="numeric">{grace}</span> min grace
              </>
            ) : null}
            .
          </Row>
        ) : (
          <Row icon={Clock} title="How often">
            Every <span className="numeric">{intervalLabel(f.intervalSeconds)}</span>, timing out after{" "}
            <span className="numeric">{Number(f.timeoutSeconds) || "?"}</span> s.
          </Row>
        )}
        {f.type !== "heartbeat" && (
          <Row icon={ShieldCheck} title="Healthy when">
            {healthy(f)}
          </Row>
        )}
        <Row icon={BellRing} title="Alert rule">
          {f.type === "heartbeat" ? (
            <>Alert {recipients} when a ping is late.</>
          ) : (
            <>
              Alert {recipients} after <span className="numeric">{f.failureThreshold}</span> failed check
              {f.failureThreshold === 1 ? "" : "s"} in a row
              <span className="text-muted-foreground">
                {" "}
                (about <span className="numeric">{formatInterval(Math.round(detectMinutes * 60))}</span>)
              </span>
              .
            </>
          )}{" "}
          {f.reminderMinutes > 0 ? (
            <>
              While down, remind {REMINDER_LABEL[f.reminderMinutes as keyof typeof REMINDER_LABEL]?.toLowerCase()}.
            </>
          ) : (
            <span className="text-muted-foreground">No reminders while down.</span>
          )}
        </Row>
        {f.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t pt-3">
            {f.tags.map((t) => (
              <span key={t} className="inline-flex h-6 items-center rounded-md border bg-surface px-2 text-xs">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
