"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAlertChannels, useCreateMonitor, useMonitors, useUpdateMonitor } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import {
  AlertsSection,
  AssertionsSection,
  BasicsSection,
  OrganizationSection,
  RequestSection,
  ScheduleSection,
} from "./form-sections";
import { fieldForIssue, firstErrorKey, toPayload, validate, type Errors, type FormState } from "./form-model";
import { MonitorSummary } from "./monitor-summary";

interface Props {
  mode: "create" | "edit";
  initial: FormState;
  monitorId?: string;
  cancelHref: string;
  /** Rendered above the sections, e.g. the chosen type with a "change" link. */
  header?: React.ReactNode;
}

/** Full-page monitor form shared by the create and edit routes. */
export function MonitorForm({ mode, initial, monitorId, cancelHref, header }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const create = useCreateMonitor();
  const update = useUpdateMonitor(monitorId ?? "");
  const channels = useAlertChannels();
  const monitors = useMonitors();
  const pending = create.isPending || update.isPending;
  const initialRef = useRef(JSON.stringify(initial));
  const leaving = useRef(false);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors((e) => {
      if (!Object.keys(e).length) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  const clientErrors = useMemo(() => (submitted ? validate(form) : {}), [form, submitted]);
  const errors = useMemo(() => ({ ...serverErrors, ...clientErrors }), [serverErrors, clientErrors]);
  const errorCount = Object.keys(errors).length;

  const dirty = JSON.stringify(form) !== initialRef.current;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const tagSuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of monitors.data ?? []) for (const t of m.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [monitors.data]);

  function focusField(key: string | undefined) {
    if (!key) return;
    const el = document.getElementById(key);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerErrors({});
    const found = validate(form);
    if (Object.keys(found).length) {
      // Wait a frame so the error text renders before focus moves.
      requestAnimationFrame(() => focusField(firstErrorKey(found)));
      return;
    }

    const payload = toPayload(form, mode);
    const label = form.name.trim() || "Monitor";
    try {
      if (mode === "create") {
        const { id } = await create.mutateAsync(payload);
        leaving.current = true;
        toast.success(`${label} created`, {
          description: form.type === "heartbeat" ? "Add the ping URL to your job to start receiving heartbeats." : "The first check runs within a minute.",
        });
        router.push(`/dashboard/monitors/${id}`);
      } else {
        await update.mutateAsync(payload);
        leaving.current = true;
        toast.success("Changes saved");
        router.push(cancelHref);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const issues = (err.response?.data as { issues?: { path: string; message: string }[] } | undefined)?.issues;
        if (issues?.length) {
          const mapped: Errors = {};
          for (const issue of issues) mapped[fieldForIssue(issue.path)] ??= issue.message;
          setServerErrors(mapped);
          requestAnimationFrame(() => focusField(firstErrorKey(mapped)));
        } else {
          const message = apiErrorMessage(err, "");
          // URL safety checks come back as plain messages; attach them to the target field.
          if (/url|address|host/i.test(message) && (form.type === "http" || form.type === "tcp")) {
            const key = form.type === "http" ? "url" : "host";
            setServerErrors({ [key]: message });
            requestAnimationFrame(() => focusField(key));
          }
        }
      }
      toast.error(apiErrorMessage(err, mode === "create" ? "Couldn't create the monitor." : "Couldn't save your changes."));
    }
  }

  const sectionProps = { form, set, errors };

  return (
    <form onSubmit={onSubmit} noValidate className="pb-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-5">
          {header}
          <BasicsSection {...sectionProps} />
          {form.type === "http" && <RequestSection {...sectionProps} />}
          {form.type !== "heartbeat" && <AssertionsSection {...sectionProps} />}
          {form.type !== "heartbeat" && <ScheduleSection {...sectionProps} />}
          <AlertsSection
            {...sectionProps}
            channels={channels.data}
            channelsLoading={channels.isPending}
            channelsError={channels.isError}
          />
          <OrganizationSection {...sectionProps} suggestions={tagSuggestions} />
        </div>
        <aside className="hidden lg:block" aria-label="Summary">
          <div className="sticky top-20 grid gap-3">
            <MonitorSummary form={form} channels={channels.data} />
            <p className="px-1 text-xs text-muted-foreground">
              Checks run from our servers. Changes take effect from the next check.
            </p>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p
            className={cn(
              "mr-auto flex items-center gap-1.5 text-xs",
              errorCount ? "font-medium text-destructive" : "text-muted-foreground"
            )}
            role={errorCount ? "alert" : undefined}
          >
            {errorCount ? (
              <>
                <AlertCircle className="size-3.5" aria-hidden="true" />
                <span>
                  <span className="numeric">{errorCount}</span> field{errorCount === 1 ? " needs" : "s need"} attention
                </span>
              </>
            ) : dirty ? (
              "Unsaved changes"
            ) : mode === "edit" ? (
              "No changes yet"
            ) : null}
          </p>
          <Button asChild variant="outline" className="h-10">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" className="h-10 min-w-32" disabled={pending || (mode === "edit" && !dirty)} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {mode === "create" ? (pending ? "Creating…" : "Create monitor") : pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
