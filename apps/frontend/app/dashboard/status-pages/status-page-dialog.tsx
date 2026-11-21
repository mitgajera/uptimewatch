"use client";
import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useMonitors, useSaveStatusPage } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { StatusPage } from "@/lib/api/types";
import { displayName } from "@/lib/monitor-format";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page?: StatusPage;
}

export function StatusPageDialog({ open, onOpenChange, page }: Props) {
  const id = useId();
  const monitors = useMonitors();
  const save = useSaveStatusPage();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [websiteIds, setWebsiteIds] = useState<string[]>([]);
  const [published, setPublished] = useState(true);
  const [errors, setErrors] = useState<{ title?: string; slug?: string; form?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle(page?.title ?? "");
    setSlug(page?.slug ?? "");
    setSlugTouched(Boolean(page));
    setDescription(page?.description ?? "");
    setWebsiteIds(page?.websiteIds ?? []);
    setPublished(page?.published ?? true);
    setErrors({});
  }, [open, page]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Give the page a title.";
    if (!SLUG_RE.test(slug)) next.slug = "Use 3-48 lowercase letters, numbers and dashes.";
    setErrors(next);
    if (next.title || next.slug) {
      document.getElementById(`${id}-${next.title ? "title" : "slug"}`)?.focus();
      return;
    }

    try {
      await save.mutateAsync({ id: page?.id, title: title.trim(), slug, description: description.trim(), websiteIds, published });
      toast.success(page ? "Status page saved" : "Status page created");
      onOpenChange(false);
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the status page.");
      if (/url|slug|taken/i.test(message)) {
        setErrors({ slug: message });
        document.getElementById(`${id}-slug`)?.focus();
      } else {
        setErrors({ form: message });
      }
    }
  }

  const toggle = (monitorId: string, checked: boolean) =>
    setWebsiteIds((ids) => (checked ? [...ids, monitorId] : ids.filter((x) => x !== monitorId)));

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{page ? "Edit status page" : "New status page"}</DialogTitle>
          <DialogDescription>A public page your users can check during an outage.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.form && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.form}
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input
              id={`${id}-title`}
              autoComplete="off"
              placeholder="Acme status"
              maxLength={100}
              value={title}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? `${id}-title-error` : undefined}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
                setErrors((x) => ({ ...x, title: undefined }));
              }}
            />
            {errors.title && (
              <p id={`${id}-title-error`} className="text-xs font-medium text-destructive">
                {errors.title}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-slug`}>Page address</Label>
            <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring">
              <span className="truncate pl-3 text-sm text-muted-foreground">{origin}/status/</span>
              <Input
                id={`${id}-slug`}
                autoComplete="off"
                spellCheck={false}
                placeholder="acme"
                maxLength={48}
                className="border-0 pl-0.5 shadow-none focus-visible:ring-0"
                value={slug}
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={errors.slug ? `${id}-slug-error` : undefined}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase());
                  setSlugTouched(true);
                  setErrors((x) => ({ ...x, slug: undefined }));
                }}
              />
            </div>
            {errors.slug && (
              <p id={`${id}-slug-error`} className="text-xs font-medium text-destructive">
                {errors.slug}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-description`}>
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`${id}-description`}
              rows={2}
              maxLength={500}
              placeholder="Live status of the Acme API and dashboard."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Monitors to show</legend>
            {monitors.isPending ? (
              <p className="text-sm text-muted-foreground">Loading monitors…</p>
            ) : (monitors.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Create a monitor first, then add it here.</p>
            ) : (
              <div className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {monitors.data!.map((m) => {
                  const checkboxId = `${id}-m-${m.id}`;
                  return (
                    <label
                      key={m.id}
                      htmlFor={checkboxId}
                      className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm hover:bg-secondary/50"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={websiteIds.includes(m.id)}
                        onCheckedChange={(v) => toggle(m.id, v === true)}
                      />
                      <span className="truncate">{displayName(m)}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Only monitor names are shown publicly — never their URLs.
            </p>
          </fieldset>

          <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
            <Label htmlFor={`${id}-published`} className="font-normal">
              Published
              <span className="block text-xs text-muted-foreground">Unpublished pages return “not found”.</span>
            </Label>
            <Switch id={`${id}-published`} checked={published} onCheckedChange={setPublished} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending} aria-busy={save.isPending}>
              {save.isPending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
              {page ? "Save changes" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
