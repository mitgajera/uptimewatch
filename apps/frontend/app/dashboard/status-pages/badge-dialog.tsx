"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_BACKEND_URL } from "@/config";
import type { StatusPage } from "@/lib/api/types";
import { copyText } from "@/lib/clipboard";

function Snippet({ id, label, code }: { id: string; label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <div className="flex gap-2">
        <pre aria-labelledby={id} className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-xs">
          <code>{code}</code>
        </pre>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          aria-label={copied ? "Copied" : `Copy ${label}`}
          onClick={() =>
            copyText(code).then(
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
      </div>
    </div>
  );
}

export function BadgeDialog({ page, onOpenChange }: { page: StatusPage | null; onOpenChange: (open: boolean) => void }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const badge = page ? `${API_BACKEND_URL}/api/v1/public/status-pages/${page.slug}/badge.svg` : "";
  const link = page ? `${origin}/status/${page.slug}` : "";

  return (
    <Dialog open={page !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Status badge</DialogTitle>
          <DialogDescription>Show live status in a README or site footer. It links to your status page.</DialogDescription>
        </DialogHeader>
        {page && (
          <div className="grid gap-4">
            <div className="grid place-items-center rounded-md border p-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- external, dynamic SVG */}
              <img src={badge} alt={`${page.title} status badge`} height={20} />
            </div>
            <Snippet id="badge-md" label="Markdown" code={`[![Status](${badge})](${link})`} />
            <Snippet
              id="badge-html"
              label="HTML"
              code={`<a href="${link}"><img src="${badge}" alt="Status" height="20"></a>`}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
