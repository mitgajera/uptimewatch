"use client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_BACKEND_URL } from "@/config";
import type { StatusPage } from "@/lib/api/types";
import { CopyButton } from "./copy-button";

function Snippet({ id, label, code }: { id: string; label: string; code: string }) {
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div className="flex items-start gap-2">
        <pre
          aria-labelledby={id}
          className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-surface px-3 py-2.5 font-mono text-xs leading-relaxed"
        >
          <code>{code}</code>
        </pre>
        <CopyButton text={code} label={`Copy ${label} snippet`} />
      </div>
    </div>
  );
}

/** Embeddable SVG status badge with copyable Markdown and HTML snippets. */
export function BadgeDialog({ page, onOpenChange }: { page: StatusPage | null; onOpenChange: (open: boolean) => void }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const badge = page ? `${API_BACKEND_URL}/api/v1/public/status-pages/${page.slug}/badge.svg` : "";
  const link = page ? `${origin}/status/${page.slug}` : "";

  return (
    <Dialog open={page !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Status badge</DialogTitle>
          <DialogDescription>
            Show live status in a README or site footer. The badge links to your status page.
          </DialogDescription>
        </DialogHeader>
        {page && (
          <div className="min-w-0 space-y-4">
            <div className="bg-grid grid place-items-center rounded-xl border bg-surface px-6 py-8">
              {/* eslint-disable-next-line @next/next/no-img-element -- external, dynamic SVG */}
              <img src={badge} alt={`${page.title} status badge`} height={20} className="h-5 w-auto" />
            </div>
            {!page.published && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                This page is a draft. The badge and link start working once you publish it.
              </p>
            )}
            <Snippet id="badge-md" label="Markdown" code={`[![Status](${badge})](${link})`} />
            <Snippet
              id="badge-html"
              label="HTML"
              code={`<a href="${link}"><img src="${badge}" alt="Status" height="20"></a>`}
            />
            <Snippet id="badge-url" label="Image URL" code={badge} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
