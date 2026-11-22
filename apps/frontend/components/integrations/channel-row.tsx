"use client";

import { useState } from "react";
import axios from "axios";
import { Loader2, MoreHorizontal, Send, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useDeleteAlertChannel, useTestAlertChannel, useUpdateAlertChannel } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { AlertChannel } from "@/lib/api/types";
import { timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { INTEGRATIONS, maskTarget } from "./catalog";
import { IntegrationIcon } from "./integration-icon";

export function ChannelRow({ channel }: { channel: AlertChannel }) {
  const update = useUpdateAlertChannel();
  const remove = useDeleteAlertChannel();
  const test = useTestAlertChannel();
  const [confirming, setConfirming] = useState(false);
  const meta = INTEGRATIONS[channel.type];
  const title = channel.name || meta.label;
  const masked = maskTarget(channel);

  function sendTest() {
    test.mutate(channel.id, {
      onSuccess: () =>
        toast.success(`Test alert sent to ${title}`, {
          description: channel.enabled ? undefined : "This channel is off, so real alerts won't go here yet.",
        }),
      onError: (err) => {
        if (axios.isAxiosError(err) && err.response?.status === 429) {
          toast.warning("Test limit reached", {
            description: "You can send 5 test alerts every 10 minutes. Try again in a few minutes.",
          });
        } else {
          toast.error(`Test to ${title} failed`, { description: apiErrorMessage(err, "The provider rejected the message.") });
        }
      },
    });
  }

  function toggle(enabled: boolean) {
    update.mutate(
      { id: channel.id, enabled },
      {
        onSuccess: () => toast.success(`${title} ${enabled ? "enabled" : "paused"}`),
        onError: (err) => toast.error(apiErrorMessage(err, "Could not update the channel.")),
      }
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:gap-4">
      <IntegrationIcon type={channel.type} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className={cn("truncate text-sm font-medium", !channel.enabled && "text-muted-foreground")}>{title}</p>
          {!channel.enabled && (
            <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
              Paused
            </span>
          )}
        </div>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">{meta.label}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate font-mono" title={masked}>
            {masked}
          </span>
          <span className="hidden shrink-0 md:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden shrink-0 md:inline">added {timeAgo(channel.createdAt)}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-9 sm:inline-flex"
          disabled={test.isPending}
          onClick={sendTest}
        >
          {test.isPending ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          Send test
        </Button>
        <div className="grid h-9 place-items-center px-1">
          <Switch
            checked={channel.enabled}
            disabled={update.isPending}
            onCheckedChange={toggle}
            aria-label={`${title} alerts ${channel.enabled ? "on" : "off"}`}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={`More actions for ${title}`}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onSelect={sendTest} disabled={test.isPending} className="sm:hidden">
              <Send className="size-4" aria-hidden="true" />
              Send test
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirming} onOpenChange={(o) => !remove.isPending && setConfirming(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Alerts stop going to <span className="font-mono text-foreground">{masked}</span>, including from monitors that
              route to it. You&apos;ll need to re-enter it to add it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(channel.id, {
                  onSuccess: () => {
                    toast.success(`${title} deleted`);
                    setConfirming(false);
                  },
                  onError: (err) => toast.error(apiErrorMessage(err, "Could not delete the channel.")),
                })
              }
            >
              {remove.isPending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
