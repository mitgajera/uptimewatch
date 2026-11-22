"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  BellRing,
  CalendarClock,
  FileCheck2,
  Mail,
  MessageSquare,
  Send,
  SlidersHorizontal,
  Tags,
  Target,
  Webhook,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DNS_RECORD_TYPES,
  MONITOR_INTERVALS,
  MONITOR_METHODS,
  REMINDER_OPTIONS,
  type AlertChannel,
  type AlertChannelType,
  type DnsRecordType,
  type KeywordMode,
  type MonitorMethod,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { describe, Field, FormSection, HeadersEditor, Segmented, TagsInput } from "./form-fields";
import {
  BODY_METHODS,
  intervalLabel,
  LIMITS,
  REMINDER_LABEL,
  STATUS_PRESETS,
  type Errors,
  type FormState,
  type StatusPreset,
} from "./form-model";

export interface SectionProps {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors: Errors;
}

/** Bordered row with a label, description and a switch; the whole label toggles it. */
function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-surface/50">
      <div className="flex items-center justify-between gap-4 px-3.5 py-3">
        <label htmlFor={id} className="min-w-0 cursor-pointer">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children && <div className="border-t px-3.5 py-3">{children}</div>}
    </div>
  );
}

/** Input with a unit label glued to its right edge. */
function UnitInput({ unit, className, ...props }: React.ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className={cn("flex", className)}>
      <Input {...props} className="numeric rounded-r-none" inputMode="numeric" />
      <span className="inline-flex h-10 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-xs text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

function IntervalSelect({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MONITOR_INTERVALS.map((s) => (
          <SelectItem key={s} value={String(s)}>
            Every {intervalLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---- Basics -----------------------------------------------------------------

export function BasicsSection({ form: f, set, errors }: SectionProps) {
  return (
    <FormSection id="basics" title="Basics" description="What to monitor and what to call it." icon={Target}>
      {f.type === "http" && (
        <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <Field id="method" label="Method">
            <Select value={f.method} onValueChange={(v) => set("method", v as MonitorMethod)}>
              <SelectTrigger id="method" className="font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONITOR_METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="font-mono text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="url" label="URL" error={errors.url} hint="Include the protocol. Private and internal addresses are blocked.">
            <Input
              {...describe("url", errors.url, true)}
              type="url"
              inputMode="url"
              placeholder="https://api.example.com/health"
              value={f.url}
              onChange={(e) => set("url", e.target.value)}
              className="font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </Field>
        </div>
      )}

      {(f.type === "tcp" || f.type === "dns") && (
        <div className={cn("grid gap-4", f.type === "tcp" ? "sm:grid-cols-[minmax(0,1fr)_8rem]" : "sm:grid-cols-[minmax(0,1fr)_9rem]")}>
          <Field id="host" label="Host" error={errors.host} hint={f.type === "tcp" ? "Hostname or IP address." : "The name to look up."}>
            <Input
              {...describe("host", errors.host, true)}
              placeholder={f.type === "tcp" ? "db.example.com" : "example.com"}
              value={f.host}
              onChange={(e) => set("host", e.target.value)}
              className="font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </Field>
          {f.type === "tcp" ? (
            <Field id="port" label="Port" error={errors.port}>
              <Input
                {...describe("port", errors.port)}
                inputMode="numeric"
                placeholder="5432"
                value={f.port}
                onChange={(e) => set("port", e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="numeric font-mono"
              />
            </Field>
          ) : (
            <Field id="dnsRecordType" label="Record type">
              <Select value={f.dnsRecordType} onValueChange={(v) => set("dnsRecordType", v as DnsRecordType)}>
                <SelectTrigger id="dnsRecordType" className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DNS_RECORD_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="font-mono text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      )}

      {f.type === "dns" && (
        <Field
          id="dnsExpected"
          label="Expected value"
          optional
          error={errors.dnsExpected}
          hint="Leave empty to accept any answer. Otherwise a record must contain this text (case-insensitive)."
        >
          <Input
            {...describe("dnsExpected", errors.dnsExpected, true)}
            placeholder={f.dnsRecordType === "MX" ? "mail.example.com" : f.dnsRecordType === "TXT" ? "v=spf1" : "93.184.216.34"}
            value={f.dnsExpected}
            onChange={(e) => set("dnsExpected", e.target.value)}
            className="font-mono text-sm"
            maxLength={LIMITS.dnsExpected + 20}
            spellCheck={false}
          />
        </Field>
      )}

      <Field
        id="name"
        label="Display name"
        optional={f.type !== "heartbeat"}
        error={errors.name}
        hint={f.type === "heartbeat" ? "Shown in alerts, e.g. Nightly backup." : "Defaults to the host name. Shown in alerts and on status pages."}
      >
        <Input
          {...describe("name", errors.name, true)}
          placeholder={f.type === "heartbeat" ? "Nightly backup" : "Production API"}
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={LIMITS.name + 20}
          autoFocus={f.type === "heartbeat"}
        />
      </Field>

      {f.type === "heartbeat" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="intervalSeconds" label="Expected every" hint="How often your job runs.">
            <IntervalSelect id="intervalSeconds" value={f.intervalSeconds} onChange={(v) => set("intervalSeconds", v)} />
          </Field>
          <Field id="graceMinutes" label="Grace period" error={errors.graceMinutes} hint="Extra time before a late ping counts as missed.">
            <UnitInput
              {...describe("graceMinutes", errors.graceMinutes, true)}
              unit="minutes"
              value={f.graceMinutes}
              onChange={(e) => set("graceMinutes", e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </Field>
        </div>
      )}
    </FormSection>
  );
}

// ---- Request (HTTP) ---------------------------------------------------------

export function RequestSection({ form: f, set, errors }: SectionProps) {
  const hasBody = BODY_METHODS.includes(f.method);
  return (
    <FormSection id="request" title="Request" description="Headers, body and redirect handling." icon={SlidersHorizontal}>
      <HeadersEditor rows={f.headers} onChange={(rows) => set("headers", rows)} errors={errors} />
      {hasBody && (
        <Field
          id="body"
          label="Request body"
          optional
          error={errors.body}
          hint={
            <>
              Sent with {f.method} requests. Add a <span className="font-mono">Content-Type</span> header to match.{" "}
              <span className="numeric">
                {f.body.length.toLocaleString()}/{LIMITS.body.toLocaleString()}
              </span>
            </>
          }
        >
          <Textarea
            {...describe("body", errors.body, true)}
            rows={5}
            placeholder={'{ "ping": true }'}
            value={f.body}
            onChange={(e) => set("body", e.target.value)}
            className="font-mono text-xs md:text-xs"
            spellCheck={false}
          />
        </Field>
      )}
      <ToggleRow
        id="followRedirects"
        label="Follow redirects"
        description="Check the final page instead of the 3xx response."
        checked={f.followRedirects}
        onCheckedChange={(v) => set("followRedirects", v)}
      />
    </FormSection>
  );
}

// ---- Assertions -------------------------------------------------------------

export function AssertionsSection({ form: f, set, errors }: SectionProps) {
  const isHttp = f.type === "http";
  return (
    <FormSection id="assertions" title="Assertions" description="When a check counts as up, degraded or down." icon={FileCheck2}>
      {isHttp && (
        <>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium" id="statusPreset-label">
              Expected status codes
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented<StatusPreset>
                label="Expected status codes"
                value={f.statusPreset}
                onChange={(v) => set("statusPreset", v)}
                options={STATUS_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
              />
              {f.statusPreset !== "custom" && (
                <span className="font-mono text-xs text-muted-foreground">
                  {STATUS_PRESETS.find((p) => p.value === f.statusPreset)?.expected}
                </span>
              )}
            </div>
            {f.statusPreset === "custom" && (
              <div className="mt-1.5 grid gap-1.5">
                <label htmlFor="expectedStatus" className="sr-only">
                  Custom status codes
                </label>
                <Input
                  {...describe("expectedStatus", errors.expectedStatus, true)}
                  placeholder="200-299,301"
                  value={f.expectedStatus}
                  onChange={(e) => set("expectedStatus", e.target.value)}
                  className="max-w-xs font-mono text-sm"
                  spellCheck={false}
                />
                {errors.expectedStatus ? (
                  <p id="expectedStatus-error" className="text-xs font-medium text-destructive">
                    {errors.expectedStatus}
                  </p>
                ) : (
                  <p id="expectedStatus-hint" className="text-xs text-muted-foreground">
                    Comma-separated codes and ranges.
                  </p>
                )}
              </div>
            )}
          </div>

          <Field
            id="keyword"
            label="Keyword"
            optional
            error={errors.keyword}
            hint="Case-sensitive text matched against the response body."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={f.keywordMode} onValueChange={(v) => set("keywordMode", v as KeywordMode)}>
                <SelectTrigger className="sm:w-44" aria-label="Keyword rule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Body contains</SelectItem>
                  <SelectItem value="absent">Body doesn&apos;t contain</SelectItem>
                </SelectContent>
              </Select>
              <Input
                {...describe("keyword", errors.keyword, true)}
                placeholder={f.keywordMode === "absent" ? "Internal Server Error" : '"status":"ok"'}
                value={f.keyword}
                onChange={(e) => set("keyword", e.target.value)}
                className="min-w-0 flex-1 font-mono text-sm"
                maxLength={LIMITS.keyword + 20}
                spellCheck={false}
              />
            </div>
          </Field>
        </>
      )}

      {f.type === "dns" && (
        <p className="text-sm text-muted-foreground">
          A DNS check is up when the lookup succeeds and, if you set an expected value above, a record contains it.
        </p>
      )}

      {(isHttp || f.type === "tcp") && (
        <ToggleRow
          id="degradedEnabled"
          label="Flag slow responses as degraded"
          description="Slower than this counts as degraded."
          checked={f.degradedEnabled}
          onCheckedChange={(v) => set("degradedEnabled", v)}
        >
          <Field id="degradedMs" label="Degraded above" error={errors.degradedMs} hint="Between 100 and 30,000 ms.">
            <UnitInput
              {...describe("degradedMs", errors.degradedMs, true)}
              unit="ms"
              value={f.degradedMs}
              onChange={(e) => set("degradedMs", e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="max-w-48"
            />
          </Field>
        </ToggleRow>
      )}
    </FormSection>
  );
}

// ---- Schedule ---------------------------------------------------------------

export function ScheduleSection({ form: f, set, errors }: SectionProps) {
  return (
    <FormSection id="schedule" title="Schedule" description="How often to check and how patient to be." icon={CalendarClock}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="intervalSeconds" label="Check interval">
          <IntervalSelect id="intervalSeconds" value={f.intervalSeconds} onChange={(v) => set("intervalSeconds", v)} />
        </Field>
        <Field id="timeoutSeconds" label="Timeout" error={errors.timeoutSeconds} hint="1–30 seconds.">
          <UnitInput
            {...describe("timeoutSeconds", errors.timeoutSeconds, true)}
            unit="sec"
            value={f.timeoutSeconds}
            onChange={(e) => set("timeoutSeconds", e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </Field>
        <Field id="failureThreshold" label="Confirm outage after" hint="Avoids alerts for one-off blips.">
          <Select value={String(f.failureThreshold)} onValueChange={(v) => set("failureThreshold", Number(v))}>
            <SelectTrigger id="failureThreshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} failed check{n === 1 ? "" : "s"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormSection>
  );
}

// ---- Alerts -----------------------------------------------------------------

const CHANNEL_ICON: Record<AlertChannelType, typeof Mail> = {
  email: Mail,
  slack: MessageSquare,
  discord: MessageSquare,
  teams: MessageSquare,
  googlechat: MessageSquare,
  webhook: Webhook,
  telegram: Send,
  ntfy: Bell,
};

const CHANNEL_LABEL: Record<AlertChannelType, string> = {
  email: "Email",
  slack: "Slack",
  discord: "Discord",
  teams: "Microsoft Teams",
  googlechat: "Google Chat",
  webhook: "Webhook",
  telegram: "Telegram",
  ntfy: "ntfy",
};

export function AlertsSection({
  form: f,
  set,
  errors,
  channels,
  channelsLoading,
  channelsError,
}: SectionProps & { channels: AlertChannel[] | undefined; channelsLoading: boolean; channelsError: boolean }) {
  const list = channels ?? [];
  const enabledCount = list.filter((c) => c.enabled).length;
  const toggle = (id: string, on: boolean) =>
    set("alertChannelIds", on ? [...f.alertChannelIds, id] : f.alertChannelIds.filter((x) => x !== id));

  return (
    <FormSection id="alerts" title="Alerts" description="Who hears about it when this monitor goes down." icon={BellRing}>
      {channelsLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : channelsError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load your alert channels. Alerts will go to all enabled channels.</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">No alert channels yet</p>
            <p className="text-xs text-muted-foreground">Connect email, Slack, Discord and more to get notified.</p>
          </div>
          <Link
            href="/dashboard/integrations"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Set up integrations
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          <Segmented<"all" | "selected">
            label="Alert recipients"
            value={f.alertMode}
            onChange={(v) => set("alertMode", v)}
            options={[
              { value: "all", label: "All channels" },
              { value: "selected", label: "Selected channels" },
            ]}
          />
          {f.alertMode === "all" ? (
            <p className="text-sm text-muted-foreground">
              Alerts go to every enabled channel (<span className="numeric">{enabledCount}</span> right now), including
              ones you add later.
            </p>
          ) : (
            <fieldset
              id="alertChannelIds"
              tabIndex={-1}
              aria-invalid={errors.alertChannelIds ? true : undefined}
              aria-describedby={errors.alertChannelIds ? "alertChannelIds-error" : undefined}
              className="grid gap-px overflow-hidden rounded-lg border bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <legend className="sr-only">Channels that receive this monitor&apos;s alerts</legend>
              {list.map((c) => {
                const Icon = CHANNEL_ICON[c.type] ?? Bell;
                const checked = f.alertChannelIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    htmlFor={`channel-${c.id}`}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 bg-card px-3.5 py-2.5 transition-colors hover:bg-accent/50",
                      checked && "bg-accent/40"
                    )}
                  >
                    <Checkbox id={`channel-${c.id}`} checked={checked} onCheckedChange={(v) => toggle(c.id, v === true)} />
                    <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-surface text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {CHANNEL_LABEL[c.type]} · <span className="font-mono">{c.target}</span>
                      </span>
                    </span>
                    {!c.enabled && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
          )}
          {errors.alertChannelIds && (
            <p id="alertChannelIds-error" className="text-xs font-medium text-destructive">
              {errors.alertChannelIds}
            </p>
          )}
        </div>
      )}

      <Field id="reminderMinutes" label="Repeat alerts while down" hint="Re-notify until the monitor recovers.">
        <Select value={String(f.reminderMinutes)} onValueChange={(v) => set("reminderMinutes", Number(v))}>
          <SelectTrigger id="reminderMinutes" className="sm:max-w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REMINDER_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {REMINDER_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormSection>
  );
}

// ---- Organization -----------------------------------------------------------

export function OrganizationSection({ form: f, set, errors, suggestions }: SectionProps & { suggestions: string[] }) {
  return (
    <FormSection id="organization" title="Organization" description="Tags group monitors for filtering and bulk actions." icon={Tags}>
      <Field id="tags" label="Tags" optional error={undefined}>
        <TagsInput id="tags" tags={f.tags} onChange={(t) => set("tags", t)} error={errors.tags} suggestions={suggestions} />
      </Field>
    </FormSection>
  );
}
