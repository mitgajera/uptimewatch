"use client";
import { useId, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePostIncidentUpdate } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import { INCIDENT_UPDATE_STATUSES, type Incident, type IncidentUpdateStatus } from "@/lib/api/types";
import { UPDATE_STATUS } from "@/components/status-pages/status-meta";
import { cn } from "@/lib/utils";

const MAX = 2000;

function defaultStatus(incident: Incident): IncidentUpdateStatus {
  if (!incident.ongoing) return "resolved";
  const latest = [...incident.updates].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  return latest && latest.status !== "resolved" ? latest.status : "investigating";
}

/** Post a status update to an incident (optionally shown on status pages). */
export function IncidentComposer({ incident }: { incident: Incident }) {
  const id = useId();
  const post = usePostIncidentUpdate(incident.id);
  const [status, setStatus] = useState<IncidentUpdateStatus>(() => defaultStatus(incident));
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) {
      setError("Write a short update first.");
      document.getElementById(`${id}-message`)?.focus();
      return;
    }
    try {
      await post.mutateAsync({ message: text, status, public: isPublic });
      setMessage("");
      setError(null);
      toast.success(isPublic ? "Update posted to your status pages" : "Internal update posted");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not post the update."));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Post an update</h3>
        <div className="w-40">
          <Label htmlFor={`${id}-status`} className="sr-only">
            Update status
          </Label>
          <Select value={status} onValueChange={(v) => setStatus(v as IncidentUpdateStatus)}>
            <SelectTrigger id={`${id}-status`} className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INCIDENT_UPDATE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", UPDATE_STATUS[s].dot)} aria-hidden="true" />
                    {UPDATE_STATUS[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-message`}>Message</Label>
        <Textarea
          id={`${id}-message`}
          rows={4}
          maxLength={MAX}
          placeholder="We've identified the cause and are rolling out a fix."
          value={message}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(e) => {
            setMessage(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          {error ? (
            <p id={`${id}-error`} className="font-medium text-destructive">
              {error}
            </p>
          ) : (
            <p id={`${id}-hint`} className="text-muted-foreground">
              <kbd className="font-mono">Ctrl</kbd>/<kbd className="font-mono">⌘</kbd> + <kbd className="font-mono">Enter</kbd> to post
            </p>
          )}
          <span className={cn("numeric text-muted-foreground", message.length > MAX - 100 && "text-warning")}>
            {message.length}/{MAX}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Switch id={`${id}-public`} checked={isPublic} onCheckedChange={setIsPublic} />
          <Label htmlFor={`${id}-public`} className="font-normal">
            Show on status pages
          </Label>
        </div>
        <Button type="submit" className="h-9" disabled={post.isPending} aria-busy={post.isPending}>
          {post.isPending ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          Post update
        </Button>
      </div>
    </form>
  );
}
