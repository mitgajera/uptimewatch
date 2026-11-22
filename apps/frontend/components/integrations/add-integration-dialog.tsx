"use client";

import { useEffect, useId, useState } from "react";
import axios from "axios";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAlertChannel } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { AlertChannelType } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { INTEGRATIONS, WEBHOOK_EXAMPLE, validateTelegramChatId } from "./catalog";
import { IntegrationIcon } from "./integration-icon";

type Field = "name" | "target" | "chatId";
type FieldErrors = Partial<Record<Field, string>>;

/** Splits an API validation error into per-field messages plus a general one. */
function parseApiError(error: unknown): { fields: FieldErrors; general: string | null } {
  const fields: FieldErrors = {};
  if (axios.isAxiosError(error)) {
    const issues = (error.response?.data as { issues?: { path: string; message: string }[] } | undefined)?.issues;
    if (issues?.length) {
      let unmatched: string | null = null;
      for (const issue of issues) {
        const key = issue.path.split(".")[0];
        if ((key === "name" || key === "target" || key === "chatId") && !fields[key]) fields[key] = issue.message;
        else unmatched ??= issue.message;
      }
      return { fields, general: unmatched };
    }
  }
  return { fields, general: apiErrorMessage(error, "Could not add the integration.") };
}

export function AddIntegrationDialog({
  type,
  open,
  onOpenChange,
}: {
  type: AlertChannelType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateAlertChannel();
  const baseId = useId();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [chatId, setChatId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);

  // Reset the form each time a different integration opens.
  useEffect(() => {
    if (open) {
      setName("");
      setTarget("");
      setChatId("");
      setErrors({});
      setGeneral(null);
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  if (!type) return null;
  const meta = INTEGRATIONS[type];
  const isTelegram = type === "telegram";

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const t = target.trim();
    if (!t) next.target = `Enter the ${meta.targetLabel.toLowerCase()}.`;
    else {
      const err = meta.validateTarget(t);
      if (err) next.target = err;
    }
    if (isTelegram) {
      const err = validateTelegramChatId(chatId);
      if (err) next.chatId = err;
    }
    if (name.trim().length > 100) next.name = "Keep the name under 100 characters.";
    return next;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setGeneral(null);
    if (Object.keys(next).length) {
      const first = (["name", "target", "chatId"] as const).find((f) => next[f]);
      if (first) document.getElementById(`${baseId}-${first}`)?.focus();
      return;
    }
    create.mutate(
      {
        type: meta.type,
        name: name.trim() || undefined,
        target: target.trim(),
        ...(isTelegram ? { chatId: chatId.trim() } : {}),
      },
      {
        onSuccess: (channel) => {
          toast.success(`${channel.name || meta.label} connected`, {
            description: "Send a test alert to make sure it arrives.",
          });
          onOpenChange(false);
        },
        onError: (err) => {
          const parsed = parseApiError(err);
          setErrors(parsed.fields);
          setGeneral(parsed.general);
        },
      }
    );
  }

  const fieldId = (f: Field) => `${baseId}-${f}`;
  const errId = (f: Field) => `${baseId}-${f}-error`;

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <IntegrationIcon type={type} size="lg" />
            <div className="min-w-0 text-left">
              <DialogTitle>Connect {meta.label}</DialogTitle>
              <DialogDescription className="mt-0.5">{meta.blurb}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="rounded-lg border bg-surface p-3">
            <p className="text-xs font-medium">How to get this</p>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {meta.steps.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="numeric grid size-4 shrink-0 place-items-center rounded-full bg-background text-[10px] font-medium text-foreground ring-1 ring-border">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={fieldId("target")}>{meta.targetLabel}</Label>
            <Input
              id={fieldId("target")}
              type={meta.inputType}
              inputMode={meta.inputType === "email" ? "email" : meta.inputType === "url" ? "url" : "text"}
              autoComplete="off"
              spellCheck={false}
              placeholder={meta.placeholder}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                if (errors.target) setErrors((p) => ({ ...p, target: undefined }));
              }}
              onBlur={() => {
                const t = target.trim();
                if (t) setErrors((p) => ({ ...p, target: meta.validateTarget(t) ?? undefined }));
              }}
              aria-invalid={!!errors.target}
              aria-describedby={errors.target ? errId("target") : undefined}
              className="h-10 font-mono text-[13px]"
              autoFocus
            />
            {errors.target && <FieldError id={errId("target")}>{errors.target}</FieldError>}
          </div>

          {isTelegram && (
            <div className="space-y-1.5">
              <Label htmlFor={fieldId("chatId")}>Chat id</Label>
              <Input
                id={fieldId("chatId")}
                autoComplete="off"
                spellCheck={false}
                placeholder="-1001234567890 or @acme_status"
                value={chatId}
                onChange={(e) => {
                  setChatId(e.target.value);
                  if (errors.chatId) setErrors((p) => ({ ...p, chatId: undefined }));
                }}
                onBlur={() => chatId.trim() && setErrors((p) => ({ ...p, chatId: validateTelegramChatId(chatId) ?? undefined }))}
                aria-invalid={!!errors.chatId}
                aria-describedby={errors.chatId ? errId("chatId") : `${baseId}-chatId-hint`}
                className="h-10 font-mono text-[13px]"
              />
              {errors.chatId ? (
                <FieldError id={errId("chatId")}>{errors.chatId}</FieldError>
              ) : (
                <p id={`${baseId}-chatId-hint`} className="text-xs text-muted-foreground">
                  Forward a message from the chat to @userinfobot to find its id.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={fieldId("name")}>
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={fieldId("name")}
              placeholder={`${meta.label} — on-call`}
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? errId("name") : undefined}
              className="h-10"
            />
            {errors.name && <FieldError id={errId("name")}>{errors.name}</FieldError>}
          </div>

          {type === "webhook" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Payload we POST</p>
              <pre className="overflow-x-auto rounded-lg border bg-surface p-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
                {WEBHOOK_EXAMPLE}
              </pre>
              <p className="text-xs text-muted-foreground">
                <code className="font-mono">event</code> is one of <code className="font-mono">DOWN</code>,{" "}
                <code className="font-mono">UP</code>, <code className="font-mono">REMINDER</code>,{" "}
                <code className="font-mono">SSL_EXPIRY</code> or <code className="font-mono">TEST</code>.
              </p>
            </div>
          )}

          {general && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{general}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="h-10" disabled={create.isPending}>
              {create.isPending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
              Connect {meta.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className={cn("flex items-center gap-1.5 text-xs text-destructive")}>
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
