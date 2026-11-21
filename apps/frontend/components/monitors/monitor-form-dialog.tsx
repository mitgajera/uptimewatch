"use client";
import { useEffect, useId, useRef, useState } from "react";
import axios from "axios";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCreateMonitor, useUpdateMonitor } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  MONITOR_INTERVALS,
  type Monitor,
  type MonitorConfig,
  type MonitorMethod,
  type MonitorType,
} from "@/lib/api/types";
import { formatInterval } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";

type FormState = {
  type: MonitorType;
  name: string;
  url: string;
  method: MonitorMethod;
  intervalSeconds: string;
  timeoutSeconds: string;
  expectedStatus: string;
  keyword: string;
  followRedirects: boolean;
  failureThreshold: string;
  graceMinutes: string;
};

type Field = keyof FormState;
type Errors = Partial<Record<Field, string>>;

const DEFAULTS: FormState = {
  type: "http",
  name: "",
  url: "",
  method: "GET",
  intervalSeconds: "60",
  timeoutSeconds: "10",
  expectedStatus: "200-399",
  keyword: "",
  followRedirects: true,
  failureThreshold: "2",
  graceMinutes: "5",
};

function fromMonitor(m: Monitor): FormState {
  return {
    type: m.type ?? "http",
    name: m.name ?? "",
    url: m.url,
    method: m.method,
    intervalSeconds: String(m.intervalSeconds),
    timeoutSeconds: String(Math.round(m.timeoutMs / 1000)),
    expectedStatus: m.expectedStatus,
    keyword: m.keyword ?? "",
    followRedirects: m.followRedirects,
    failureThreshold: String(m.failureThreshold),
    graceMinutes: String(Math.round((m.graceSeconds ?? 300) / 60)),
  };
}

// API field paths -> form fields, for inline server-side errors.
const SERVER_FIELD: Record<string, Field> = {
  name: "name",
  url: "url",
  method: "method",
  intervalSeconds: "intervalSeconds",
  timeoutMs: "timeoutSeconds",
  expectedStatus: "expectedStatus",
  keyword: "keyword",
  followRedirects: "followRedirects",
  failureThreshold: "failureThreshold",
  graceSeconds: "graceMinutes",
};

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (f.type === "heartbeat") {
    // Number("") is 0, so a blank field must be rejected explicitly.
    const grace = Number(f.graceMinutes);
    if (!f.graceMinutes.trim() || !Number.isInteger(grace) || grace < 0 || grace > 1440) {
      errors.graceMinutes = "Use a whole number of minutes from 0 to 1440";
    }
    if (!f.name.trim()) errors.name = "Name your heartbeat, e.g. Nightly backup";
    return errors;
  }
  try {
    const u = new URL(f.url.trim());
    if (!/^https?:$/.test(u.protocol)) errors.url = "URL must start with http:// or https://";
  } catch {
    errors.url = "Enter a full URL, e.g. https://example.com/health";
  }
  const timeout = Number(f.timeoutSeconds);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30) {
    errors.timeoutSeconds = "Use a whole number of seconds from 1 to 30";
  }
  const threshold = Number(f.failureThreshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 10) {
    errors.failureThreshold = "Use a whole number from 1 to 10";
  }
  if (!/^\s*\d{3}(\s*-\s*\d{3})?(\s*,\s*\d{3}(\s*-\s*\d{3})?)*\s*$/.test(f.expectedStatus)) {
    errors.expectedStatus = 'Use codes and ranges like "200-299,301"';
  }
  return errors;
}

function toPayload(f: FormState): Partial<MonitorConfig> {
  if (f.type === "heartbeat") {
    return {
      type: "heartbeat",
      name: f.name.trim(),
      intervalSeconds: Number(f.intervalSeconds),
      graceSeconds: Number(f.graceMinutes) * 60,
    };
  }
  return {
    type: "http",
    name: f.name.trim(),
    url: f.url.trim(),
    method: f.method,
    intervalSeconds: Number(f.intervalSeconds),
    timeoutMs: Number(f.timeoutSeconds) * 1000,
    expectedStatus: f.expectedStatus.trim(),
    keyword: f.keyword,
    followRedirects: f.followRedirects,
    failureThreshold: Number(f.failureThreshold),
  };
}

interface MonitorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this monitor; omit to create a new one. */
  monitor?: Monitor;
  onSaved?: (id: string) => void;
}

export function MonitorFormDialog({ open, onOpenChange, monitor, onSaved }: MonitorFormDialogProps) {
  const isEdit = Boolean(monitor);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();

  const create = useCreateMonitor();
  const update = useUpdateMonitor(monitor?.id ?? "");
  const pending = create.isPending || update.isPending;

  // The detail page refetches the monitor every 30s; read the latest copy
  // without letting each refetch reset what the user is typing.
  const monitorRef = useRef(monitor);
  useEffect(() => {
    monitorRef.current = monitor;
  }, [monitor]);

  // Reset when the dialog opens (or targets another monitor) so stale
  // input/errors never linger.
  const monitorId = monitor?.id;
  useEffect(() => {
    if (!open) return;
    const current = monitorRef.current;
    setForm(current ? fromMonitor(current) : DEFAULTS);
    setErrors({});
    setFormError(null);
    setAdvancedOpen(false);
  }, [open, monitorId]);

  const set = <K extends Field>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const focusFirstError = (errs: Errors) => {
    const first = (Object.keys(errs) as Field[]).find((k) => errs[k]);
    if (!first) return;
    if (!["name", "url", "graceMinutes"].includes(first)) setAdvancedOpen(true);
    // Wait for the collapsible to render before focusing.
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
    );
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errs = validate(form);
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      focusFirstError(errs);
      return;
    }

    try {
      const payload = toPayload(form);
      if (monitor) {
        // The monitor type is fixed after creation.
        await update.mutateAsync({ ...payload, type: undefined });
        toast.success("Monitor updated");
        onSaved?.(monitor.id);
      } else {
        const { id: newId } = await create.mutateAsync(payload);
        toast.success("Monitor created", { description: "The first check runs within a minute." });
        onSaved?.(newId);
      }
      onOpenChange(false);
    } catch (err) {
      // Map schema issues onto fields; otherwise show a form-level error.
      const issues = axios.isAxiosError(err)
        ? (err.response?.data as { issues?: { path: string; message: string }[] })?.issues
        : undefined;
      const fieldErrors: Errors = {};
      for (const issue of issues ?? []) {
        const field = SERVER_FIELD[issue.path];
        if (field) fieldErrors[field] = issue.message;
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        focusFirstError(fieldErrors);
      } else {
        const message = apiErrorMessage(err, "Could not save the monitor.");
        // SSRF/URL problems come back as plain messages about the URL.
        if (/url|address|host/i.test(message)) {
          setErrors({ url: message });
          focusFirstError({ url: message });
        } else {
          setFormError(message);
        }
      }
    }
  }

  const fieldProps = (key: Field) => ({
    id: `${id}-${key}`,
    name: key,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : `${id}-${key}-hint`,
  });

  const FieldError = ({ field }: { field: Field }) =>
    errors[field] ? (
      <p id={`${id}-${field}-error`} className="text-xs font-medium text-destructive">
        {errors[field]}
      </p>
    ) : null;

  const Hint = ({ field, children }: { field: Field; children: React.ReactNode }) =>
    errors[field] ? null : (
      <p id={`${id}-${field}-hint`} className="text-xs text-muted-foreground">
        {children}
      </p>
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit monitor" : "New monitor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Changes apply from the next check."
              : "We'll alert you as soon as it stops responding."}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-4">
          {formError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          {!isEdit && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Type</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["http", "Website / API", "We request your URL"],
                    ["heartbeat", "Heartbeat", "Your cron job pings us"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer flex-col rounded-md border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
                      form.type === value ? "border-foreground bg-secondary" : "hover:bg-secondary/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={value}
                      checked={form.type === value}
                      onChange={() => {
                        setErrors({});
                        setForm((f) => ({
                          ...f,
                          type: value,
                          // Jobs usually run hourly or daily, not every minute.
                          intervalSeconds:
                            value === "heartbeat" && Number(f.intervalSeconds) < 300 ? "3600" : f.intervalSeconds,
                        }));
                      }}
                      className="sr-only"
                    />
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {form.type === "http" && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-url`}>URL</Label>
            <Input
              {...fieldProps("url")}
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="https://example.com/health"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              autoFocus={!isEdit}
              required
            />
            <FieldError field="url" />
            <Hint field="url">Public http(s) address. Private and internal addresses are blocked.</Hint>
          </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>
              Name{" "}
              {form.type === "http" && <span className="font-normal text-muted-foreground">(optional)</span>}
            </Label>
            <Input
              {...fieldProps("name")}
              autoComplete="off"
              placeholder={form.type === "heartbeat" ? "Nightly backup" : "Marketing site"}
              maxLength={100}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <FieldError field="name" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-intervalSeconds`}>
              {form.type === "heartbeat" ? "Expect a ping every" : "Check every"}
            </Label>
            <Select value={form.intervalSeconds} onValueChange={(v) => set("intervalSeconds", v)}>
              <SelectTrigger id={`${id}-intervalSeconds`} name="intervalSeconds" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONITOR_INTERVALS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {formatInterval(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.type === "heartbeat" && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-graceMinutes`}>Grace period (minutes)</Label>
              <Input
                {...fieldProps("graceMinutes")}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.graceMinutes}
                onChange={(e) => set("graceMinutes", e.target.value)}
              />
              <FieldError field="graceMinutes" />
              <Hint field="graceMinutes">How late a ping can be before we alert. Covers jobs that run long.</Hint>
            </div>
          )}

          {form.type === "http" && (
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="-ml-3 h-10 text-muted-foreground">
                <ChevronDown
                  className={cn("size-4 transition-transform", advancedOpen && "rotate-180")}
                  aria-hidden="true"
                />
                Advanced settings
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-method`}>HTTP method</Label>
                <Select value={form.method} onValueChange={(v) => set("method", v as MonitorMethod)}>
                  <SelectTrigger id={`${id}-method`} name="method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["GET", "HEAD", "POST"] as const).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-timeoutSeconds`}>Timeout (seconds)</Label>
                <Input
                  {...fieldProps("timeoutSeconds")}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.timeoutSeconds}
                  onChange={(e) => set("timeoutSeconds", e.target.value)}
                />
                <FieldError field="timeoutSeconds" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-expectedStatus`}>Expected status codes</Label>
                <Input
                  {...fieldProps("expectedStatus")}
                  spellCheck={false}
                  placeholder="200-399"
                  value={form.expectedStatus}
                  onChange={(e) => set("expectedStatus", e.target.value)}
                />
                <FieldError field="expectedStatus" />
                <Hint field="expectedStatus">Other responses count as down.</Hint>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-failureThreshold`}>Alert after</Label>
                <Input
                  {...fieldProps("failureThreshold")}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.failureThreshold}
                  onChange={(e) => set("failureThreshold", e.target.value)}
                />
                <FieldError field="failureThreshold" />
                <Hint field="failureThreshold">Consecutive failed checks before an incident opens.</Hint>
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor={`${id}-keyword`}>
                  Required text <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  {...fieldProps("keyword")}
                  spellCheck={false}
                  placeholder="Welcome back"
                  maxLength={200}
                  value={form.keyword}
                  onChange={(e) => set("keyword", e.target.value)}
                />
                <FieldError field="keyword" />
                <Hint field="keyword">The response body must contain this text to count as up.</Hint>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 sm:col-span-2">
                <Label htmlFor={`${id}-followRedirects`} className="font-normal">
                  Follow redirects
                  <span className="block text-xs text-muted-foreground">
                    Judge the final page instead of the 3xx response.
                  </span>
                </Label>
                <Switch
                  id={`${id}-followRedirects`}
                  name="followRedirects"
                  checked={form.followRedirects}
                  onCheckedChange={(v) => set("followRedirects", v)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
              {isEdit ? "Save changes" : "Create monitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
