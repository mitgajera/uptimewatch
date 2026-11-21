"use client";
import { useId, useState } from "react";
import { Hash, Loader2, Mail, MessageSquare, RotateCw, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAlertChannels,
  useCreateAlertChannel,
  useDeleteAlertChannel,
  useTestAlertChannel,
  useUpdateAlertChannel,
} from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { AlertChannel, AlertChannelType } from "@/lib/api/types";

const TYPES: Record<
  AlertChannelType,
  { label: string; icon: typeof Mail; targetLabel: string; placeholder: string; hint: string; inputType: string }
> = {
  email: {
    label: "Email",
    icon: Mail,
    targetLabel: "Email address",
    placeholder: "oncall@example.com",
    hint: "Send alerts to another inbox, such as a team list.",
    inputType: "email",
  },
  slack: {
    label: "Slack",
    icon: Hash,
    targetLabel: "Incoming webhook URL",
    placeholder: "https://hooks.slack.com/services/…",
    hint: "In Slack: Apps → Incoming Webhooks → Add to a channel, then copy the URL.",
    inputType: "url",
  },
  discord: {
    label: "Discord",
    icon: MessageSquare,
    targetLabel: "Webhook URL",
    placeholder: "https://discord.com/api/webhooks/…",
    hint: "In Discord: Channel settings → Integrations → Webhooks → New webhook.",
    inputType: "url",
  },
  webhook: {
    label: "Webhook",
    icon: Webhook,
    targetLabel: "Endpoint URL",
    placeholder: "https://example.com/hooks/uptime",
    hint: "We POST JSON: { event, subject, message, websiteId, timestamp }.",
    inputType: "url",
  },
};

function maskTarget(c: AlertChannel) {
  if (c.type === "email") return c.target;
  try {
    const u = new URL(c.target);
    return `${u.host}${u.pathname.length > 1 ? "/…" : ""}`;
  } catch {
    return c.target;
  }
}

function ChannelRow({ channel }: { channel: AlertChannel }) {
  const update = useUpdateAlertChannel();
  const remove = useDeleteAlertChannel();
  const test = useTestAlertChannel();
  const { icon: Icon, label } = TYPES[channel.type];
  const title = channel.name || label;
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {label} · {maskTarget(channel)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Switch
          checked={channel.enabled}
          aria-label={`${channel.enabled ? "Disable" : "Enable"} ${title}`}
          disabled={update.isPending}
          onCheckedChange={(enabled) =>
            update.mutate(
              { id: channel.id, enabled },
              { onError: (err) => toast.error(apiErrorMessage(err, "Could not update the channel.")) }
            )
          }
        />
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-10"
          disabled={test.isPending}
          onClick={() =>
            test.mutate(channel.id, {
              onSuccess: () => toast.success(`Test alert sent to ${title}`),
              onError: (err) => toast.error(apiErrorMessage(err, "Test alert failed.")),
            })
          }
        >
          {test.isPending ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          Test
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${title}`}
          disabled={remove.isPending}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <AlertDialog open={confirming} onOpenChange={(o) => !o && !remove.isPending && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Alerts stop going to {maskTarget(channel)}. You&apos;ll need to re-enter it to add it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              aria-busy={remove.isPending}
              onClick={() =>
                remove.mutate(channel.id, {
                  onSuccess: () => {
                    setConfirming(false);
                    toast.success(`Removed ${title}`);
                  },
                  onError: (err) => toast.error(apiErrorMessage(err, "Could not remove the channel.")),
                })
              }
            >
              Remove channel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function AddChannelForm() {
  const id = useId();
  const create = useCreateAlertChannel();
  const [type, setType] = useState<AlertChannelType>("slack");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const meta = TYPES[type];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!target.trim()) {
      setError(`Enter the ${meta.targetLabel.toLowerCase()}.`);
      return;
    }
    try {
      await create.mutateAsync({ type, name: name.trim(), target: target.trim() });
      toast.success(`${meta.label} channel added`, { description: "Send a test alert to check it." });
      setName("");
      setTarget("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not add the channel."));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-type`}>Type</Label>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as AlertChannelType);
            setError(null);
          }}
        >
          <SelectTrigger id={`${id}-type`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPES) as AlertChannelType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPES[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>
          Name <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${id}-name`}
          autoComplete="off"
          placeholder={type === "email" ? "On-call inbox" : "#incidents"}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-target`}>{meta.targetLabel}</Label>
        <Input
          id={`${id}-target`}
          type={meta.inputType}
          inputMode={meta.inputType === "email" ? "email" : "url"}
          autoComplete={meta.inputType === "email" ? "email" : "off"}
          spellCheck={false}
          placeholder={meta.placeholder}
          value={target}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(e) => {
            setTarget(e.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p id={`${id}-error`} className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {meta.hint}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={create.isPending} aria-busy={create.isPending}>
          {create.isPending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          Add channel
        </Button>
      </div>
    </form>
  );
}

export default function AlertsPage() {
  const channels = useAlertChannels();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Where we notify you when a monitor goes down, recovers, or its SSL certificate is about to expire.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="channels-heading">
        <h2 id="channels-heading" className="text-sm font-semibold">
          Channels
        </h2>
        {channels.isPending ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : channels.isError ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm">
            <p>Couldn&apos;t load your alert channels.</p>
            <Button className="mt-3" variant="outline" onClick={() => channels.refetch()}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : channels.data.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              No channels yet, so alerts go to your account email. Add Slack, Discord, a webhook or
              another inbox below. Once you add one, only your enabled channels are used, so disabling
              them all pauses alerts.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {channels.data.map((c) => (
              <ChannelRow key={c.id} channel={c} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-sm font-semibold">
          Add a channel
        </h2>
        <AddChannelForm />
      </section>
    </div>
  );
}
