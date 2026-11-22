"use client";
import { useState } from "react";
import { Pause, Play, Tag, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBulkMonitors } from "@/hooks/queries";
import type { BulkAction, Monitor } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { normalizeTag, TAG_PATTERN } from "./utils";

const plural = (n: number) => `${n} monitor${n === 1 ? "" : "s"}`;

function BarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: typeof Pause;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          onClick={onClick}
          disabled={disabled}
          className={cn("h-9 px-2.5 sm:px-3", className)}
          aria-label={label}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="lg:hidden">{label}</TooltipContent>
    </Tooltip>
  );
}

function AddTagPopover({
  suggestions,
  disabled,
  onSubmit,
}: {
  suggestions: string[];
  disabled: boolean;
  onSubmit: (tag: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const tag = normalizeTag(value);
  const invalid = value.trim() !== "" && !TAG_PATTERN.test(tag);

  const submit = async (t: string) => {
    if (!TAG_PATTERN.test(t)) return;
    if (await onSubmit(t)) {
      setOpen(false);
      setValue("");
    }
  };

  const matches = suggestions.filter((s) => !tag || s.includes(tag)).slice(0, 6);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-9 px-2.5 sm:px-3" disabled={disabled} aria-label="Add tag">
              <Tag className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Add tag</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="lg:hidden">Add tag</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="center" className="w-64 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(tag);
          }}
          className="space-y-2"
        >
          <label htmlFor="bulk-add-tag" className="text-xs font-medium">
            Add tag to selected
          </label>
          <div className="flex gap-2">
            <Input
              id="bulk-add-tag"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. production"
              maxLength={24}
              autoComplete="off"
              aria-invalid={invalid}
              aria-describedby="bulk-add-tag-hint"
              className="h-9"
              autoFocus
            />
            <Button type="submit" className="h-9" disabled={!tag || invalid || disabled}>
              Add
            </Button>
          </div>
          <p id="bulk-add-tag-hint" className={cn("text-xs", invalid ? "text-destructive" : "text-muted-foreground")}>
            {invalid ? "Use letters, numbers, spaces, - or _ (max 24)." : "Lower-case, up to 24 characters."}
          </p>
          {matches.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {matches.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void submit(s)}
                  className="inline-flex h-6 items-center rounded border bg-muted/60 px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
}

function RemoveTagPopover({
  tags,
  disabled,
  onSubmit,
}: {
  tags: string[];
  disabled: boolean;
  onSubmit: (tag: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 px-2.5 sm:px-3"
              disabled={disabled || tags.length === 0}
              aria-label="Remove tag"
            >
              <Tags className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Remove tag</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="lg:hidden">Remove tag</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="center" className="w-60 p-2">
        <p className="px-1 pb-2 text-xs font-medium">Remove tag from selected</p>
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={async () => {
                if (await onSubmit(t)) setOpen(false);
              }}
              className="group inline-flex h-7 items-center gap-1 rounded border bg-muted/60 pl-2 pr-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">remove</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Sticky action bar shown while monitors are selected. */
export function BulkBar({
  selected,
  allTags,
  onClear,
}: {
  selected: Monitor[];
  allTags: string[];
  onClear: () => void;
}) {
  const bulk = useBulkMonitors();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = selected.map((m) => m.id);
  const n = ids.length;
  const selectedTags = [...new Set(selected.flatMap((m) => m.tags ?? []))].sort();
  const anyActive = selected.some((m) => !m.paused);
  const anyPaused = selected.some((m) => m.paused);

  const run = async (action: BulkAction, done: string, tag?: string): Promise<boolean> => {
    try {
      const { updated } = await bulk.mutateAsync({ ids, action, tag });
      toast.success(`${done} ${plural(updated)}`);
      onClear();
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, "Bulk action failed."));
      return false;
    }
  };

  if (n === 0) return null;

  return (
    <>
      <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center pt-2">
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        >
          <span className="numeric flex h-9 shrink-0 items-center whitespace-nowrap px-3 text-sm font-medium" aria-live="polite">
            {n} selected
          </span>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <BarButton
            icon={Pause}
            label="Pause"
            disabled={bulk.isPending || !anyActive}
            onClick={() => void run("pause", "Paused")}
          />
          <BarButton
            icon={Play}
            label="Resume"
            disabled={bulk.isPending || !anyPaused}
            onClick={() => void run("resume", "Resumed")}
          />
          <AddTagPopover
            suggestions={allTags}
            disabled={bulk.isPending}
            onSubmit={(tag) => run("addTag", `Tagged "${tag}" on`, tag)}
          />
          <RemoveTagPopover
            tags={selectedTags}
            disabled={bulk.isPending}
            onSubmit={(tag) => run("removeTag", `Removed "${tag}" from`, tag)}
          />
          <BarButton
            icon={Trash2}
            label="Delete"
            disabled={bulk.isPending}
            onClick={() => setConfirmDelete(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear selection" className="shrink-0">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !bulk.isPending && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {plural(n)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their check history and incidents are removed and they disappear from status pages. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulk.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={bulk.isPending}
              onClick={async () => {
                if (await run("delete", "Deleted")) setConfirmDelete(false);
              }}
            >
              {bulk.isPending ? "Deleting…" : `Delete ${plural(n)}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
