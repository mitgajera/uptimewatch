"use client";
import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, ExternalLink, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys, useMonitors, useSaveStatusPage } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { StatusPage } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { BadgeDialog } from "../badge-dialog";
import { DeleteStatusPageDialog } from "../delete-status-page-dialog";
import { slugify } from "../preview-data";
import { AccentPicker } from "./accent-picker";
import { FIELD_ORDER, initialForm, LIMITS, validate, type EditorErrors, type EditorForm } from "./form";
import { LivePreview } from "./live-preview";
import { MonitorPicker } from "./monitor-picker";

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-xs", className)}>
      <header className="border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn("numeric text-xs text-muted-foreground", value > max - 50 && "text-warning", value > max && "text-destructive")}>
      {value}/{max}
    </span>
  );
}

/** Full-page create/edit form for a status page, with a live preview. */
export function StatusPageEditor({ page }: { page?: StatusPage }) {
  const id = useId();
  const router = useRouter();
  const qc = useQueryClient();
  const monitors = useMonitors();
  const save = useSaveStatusPage();

  const [baseline, setBaseline] = useState<EditorForm>(() => initialForm(page));
  const [form, setForm] = useState<EditorForm>(baseline);
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const [errors, setErrors] = useState<EditorErrors>({});
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [deleting, setDeleting] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key] || errors.form) setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  }

  const fieldId = (key: keyof EditorForm) => `${id}-${key}`;
  const focusField = (key: keyof EditorForm) => {
    setMobileTab("edit");
    // The accent picker's text field carries a "-hex" suffix.
    const target = key === "accentColor" ? `${fieldId(key)}-hex` : fieldId(key);
    requestAnimationFrame(() => document.getElementById(target)?.focus());
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate(form);
    setErrors(next);
    const first = FIELD_ORDER.find((k) => next[k]);
    if (first) {
      focusField(first);
      return;
    }

    // Drop monitors deleted since the page was saved; they can't be unticked.
    const available = new Set((monitors.data ?? []).map((m) => m.id));
    const payload = {
      title: form.title.trim(),
      slug: form.slug,
      description: form.description.trim(),
      logoUrl: form.logoUrl.trim(),
      accentColor: form.accentColor.toLowerCase(),
      websiteIds: form.websiteIds.filter((x) => available.has(x)),
      announcement: form.announcement.trim(),
      published: form.published,
      showIncidentHistory: form.showIncidentHistory,
    };

    try {
      const saved = await save.mutateAsync({ id: page?.id, ...payload });
      const savedForm = initialForm(saved);
      setBaseline(savedForm);
      setForm(savedForm);
      if (page) {
        toast.success("Status page saved");
      } else {
        // Seed the list so the edit page renders without waiting for the refetch.
        qc.setQueryData(queryKeys.statusPages, (old: StatusPage[] | undefined) =>
          old ? [...old.filter((p) => p.id !== saved.id), saved] : [saved]
        );
        toast.success("Status page created", {
          description: saved.published ? `Live at /status/${saved.slug}` : "Saved as a draft.",
        });
        router.replace(`/dashboard/status-pages/${saved.id}`);
      }
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the status page.");
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setErrors({ slug: "That address is already taken. Try another." });
        focusField("slug");
      } else {
        setErrors({ form: message });
        toast.error(message);
      }
    }
  }

  const titleId = fieldId("title");
  const slugId = fieldId("slug");
  const descId = fieldId("description");
  const logoId = fieldId("logoUrl");
  const annId = fieldId("announcement");
  const logoPreview = /^https:\/\/\S+$/i.test(form.logoUrl.trim()) && !errors.logoUrl ? form.logoUrl.trim() : "";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard/status-pages"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Status pages
        </Link>
        <PageHeader
          title={page ? page.title : "New status page"}
          description={
            page ? (
              <span className="font-mono text-xs">/status/{page.slug}</span>
            ) : (
              "Choose what to show, brand it, and publish. The preview updates as you type."
            )
          }
          actions={
            page ? (
              <>
                <Button type="button" variant="outline" className="h-9" onClick={() => setBadgeOpen(true)}>
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Badge
                </Button>
                {page.published && (
                  <Button variant="outline" className="h-9" asChild>
                    <a href={`/status/${page.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" />
                      Open page
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
      </div>

      {/* Phones: switch between the form and the preview. */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1 shadow-xs lg:hidden" role="group" aria-label="View">
        {(
          [
            { value: "edit", label: "Edit", icon: Pencil },
            { value: "preview", label: "Preview", icon: Eye },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={mobileTab === t.value}
            onClick={() => setMobileTab(t.value)}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              mobileTab === t.value && "bg-secondary text-foreground"
            )}
          >
            <t.icon className="size-4" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <form
          onSubmit={onSubmit}
          noValidate
          className={cn("min-w-0 space-y-6", mobileTab === "preview" && "hidden lg:block")}
          aria-label={page ? "Edit status page" : "Create status page"}
        >
          {errors.form && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.form}
            </p>
          )}

          <Section title="General" description="What visitors see at the top of the page.">
            <div className="space-y-1.5">
              <Label htmlFor={titleId}>Title</Label>
              <Input
                id={titleId}
                autoComplete="off"
                placeholder="Acme status"
                maxLength={LIMITS.title}
                value={form.title}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? `${titleId}-error` : undefined}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
                  setErrors((x) => ({ ...x, title: undefined, slug: slugTouched ? x.slug : undefined, form: undefined }));
                }}
              />
              <FieldError id={`${titleId}-error`} message={errors.title} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={slugId}>Page address</Label>
              <div
                className={cn(
                  "flex h-9 items-center overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
                  errors.slug && "border-destructive focus-within:ring-destructive/20"
                )}
              >
                <span className="flex h-full shrink-0 items-center border-r bg-surface px-3 font-mono text-xs text-muted-foreground">
                  /status/
                </span>
                <input
                  id={slugId}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="acme"
                  maxLength={48}
                  className="h-full min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground"
                  value={form.slug}
                  aria-invalid={errors.slug ? true : undefined}
                  aria-describedby={errors.slug ? `${slugId}-error` : `${slugId}-hint`}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                />
              </div>
              {errors.slug ? (
                <FieldError id={`${slugId}-error`} message={errors.slug} />
              ) : (
                <p id={`${slugId}-hint`} className="text-xs text-muted-foreground">
                  Lowercase letters, numbers and dashes. Changing it breaks old links and badges.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={descId}>
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Counter value={form.description.length} max={LIMITS.description} />
              </div>
              <Textarea
                id={descId}
                rows={2}
                maxLength={LIMITS.description}
                placeholder="Live status of the Acme API and dashboard."
                value={form.description}
                aria-invalid={errors.description ? true : undefined}
                onChange={(e) => set("description", e.target.value)}
              />
              <FieldError id={`${descId}-error`} message={errors.description} />
            </div>
          </Section>

          <Section title="Branding" description="Make it yours. Status colors always stay green, amber and red.">
            <div className="space-y-1.5">
              <Label htmlFor={logoId}>
                Logo URL <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border bg-surface">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external logo
                    <img src={logoPreview} alt="" className="size-full object-contain p-0.5" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xs text-muted-foreground" aria-hidden="true">
                      —
                    </span>
                  )}
                </span>
                <Input
                  id={logoId}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://acme.com/logo.png"
                  maxLength={LIMITS.logoUrl}
                  className="font-mono text-sm"
                  value={form.logoUrl}
                  aria-invalid={errors.logoUrl ? true : undefined}
                  aria-describedby={errors.logoUrl ? `${logoId}-error` : `${logoId}-hint`}
                  onChange={(e) => set("logoUrl", e.target.value)}
                />
              </div>
              {errors.logoUrl ? (
                <FieldError id={`${logoId}-error`} message={errors.logoUrl} />
              ) : (
                <p id={`${logoId}-hint`} className="text-xs text-muted-foreground">
                  A square PNG or SVG over https. Leave empty to show your title&apos;s initial.
                </p>
              )}
            </div>
            <AccentPicker
              id={fieldId("accentColor")}
              value={form.accentColor}
              onChange={(v) => set("accentColor", v)}
              error={errors.accentColor}
            />
          </Section>

          <Section title="Monitors" description="Tick the monitors to show, then use the arrows to set their order.">
            <MonitorPicker
              monitors={monitors.data}
              isPending={monitors.isPending}
              isError={monitors.isError}
              onRetry={() => monitors.refetch()}
              value={form.websiteIds}
              onChange={(ids) => set("websiteIds", ids)}
            />
          </Section>

          <Section title="Announcement" description="Shown as a banner above your services. Leave empty to hide it.">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={annId}>Message</Label>
                <Counter value={form.announcement.length} max={LIMITS.announcement} />
              </div>
              <Textarea
                id={annId}
                rows={3}
                maxLength={LIMITS.announcement}
                placeholder="Scheduled maintenance on Sunday 02:00–03:00 UTC. The API may be briefly unavailable."
                value={form.announcement}
                aria-invalid={errors.announcement ? true : undefined}
                onChange={(e) => set("announcement", e.target.value)}
              />
              <FieldError id={`${annId}-error`} message={errors.announcement} />
            </div>
          </Section>

          <Section title="Options">
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor={fieldId("published")} className="block font-normal">
                <span className="text-sm font-medium">Published</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Drafts return “not found” to visitors.
                </span>
              </Label>
              <Switch
                id={fieldId("published")}
                checked={form.published}
                onCheckedChange={(v) => set("published", v)}
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <Label htmlFor={fieldId("showIncidentHistory")} className="block font-normal">
                <span className="text-sm font-medium">Show incident history</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  List resolved incidents from the past 14 days. Ongoing incidents always show.
                </span>
              </Label>
              <Switch
                id={fieldId("showIncidentHistory")}
                checked={form.showIncidentHistory}
                onCheckedChange={(v) => set("showIncidentHistory", v)}
              />
            </div>
          </Section>

          {page && (
            <section className="rounded-xl border border-destructive/30 bg-card shadow-xs">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <h2 className="text-sm font-semibold text-destructive">Delete this status page</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    The public link and badges stop working. Monitors are not affected.
                  </p>
                </div>
                <Button type="button" variant="outline" className="h-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete page
                </Button>
              </div>
            </section>
          )}

          {/* Sticky save bar */}
          <div className="sticky bottom-0 z-20 -mx-1 px-1 pb-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <p className="min-w-0 truncate text-xs text-muted-foreground" aria-live="polite">
                {dirty ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
                    Unsaved changes
                  </span>
                ) : page ? (
                  "All changes saved"
                ) : (
                  "Not created yet"
                )}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {dirty && page && (
                  <Button type="button" variant="ghost" className="h-9" onClick={() => {
                    setForm(baseline);
                    setErrors({});
                  }}>
                    Discard
                  </Button>
                )}
                {/* Saving without the monitor list would silently drop the page's monitors. */}
                <Button
                  type="submit"
                  className="h-9"
                  disabled={save.isPending || !monitors.isSuccess || (Boolean(page) && !dirty)}
                  aria-busy={save.isPending}
                >
                  {save.isPending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
                  {page ? "Save changes" : form.published ? "Create & publish" : "Create draft"}
                </Button>
              </div>
            </div>
          </div>
        </form>

        <aside
          aria-label="Live preview"
          className={cn("min-w-0 lg:sticky lg:top-20", mobileTab === "edit" && "hidden lg:block")}
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live preview</h2>
            <span className="text-xs text-muted-foreground">
              {form.published ? "Visible to everyone once saved" : "Draft — only you can see this"}
            </span>
          </div>
          {monitors.data ? (
            <LivePreview form={form} monitors={monitors.data} />
          ) : (
            <div className="h-96 animate-pulse rounded-xl border bg-muted/50 motion-reduce:animate-none" aria-busy="true" />
          )}
        </aside>
      </div>

      {page && (
        <>
          <DeleteStatusPageDialog
            page={deleting ? page : null}
            onOpenChange={(o) => !o && setDeleting(false)}
            onDeleted={() => router.replace("/dashboard/status-pages")}
          />
          <BadgeDialog page={badgeOpen ? page : null} onOpenChange={(o) => !o && setBadgeOpen(false)} />
        </>
      )}
    </div>
  );
}
