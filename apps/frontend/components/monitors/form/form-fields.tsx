"use client";
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { LIMITS, newHeaderRow, normalizeTag, TAG_PATTERN, type Errors, type HeaderRow } from "./form-model";

/** A titled card holding one group of settings. */
export function FormSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-xl border bg-card shadow-xs" id={id}>
      <header className="flex items-start gap-3 border-b px-4 py-3.5 sm:px-5">
        {Icon && (
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border bg-surface text-muted-foreground">
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-sm font-semibold">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="grid gap-5 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Label + control + hint/error, with ids wired for assistive tech. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Props that link an input to its Field's hint or error. */
export function describe(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}

/** Segmented control (single choice) built on Radix ToggleGroup. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  id,
  className,
  size = "default",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  id?: string;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex w-fit max-w-full justify-start gap-0.5 rounded-lg border bg-muted/60 p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            "rounded-md px-3 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground",
            "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs data-[state=on]:ring-1 data-[state=on]:ring-border",
            size === "sm" ? "h-8 min-w-8 text-xs" : "h-9 min-w-9"
          )}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Key/value editor for request headers (max 10). */
export function HeadersEditor({
  rows,
  onChange,
  errors,
}: {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
  errors: Errors;
}) {
  const update = (key: string, patch: Partial<HeaderRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const full = rows.length >= LIMITS.headers;

  return (
    <div className="grid gap-2" id="headers" tabIndex={-1}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium" id="headers-label">
          Headers <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </p>
        <span className="numeric text-xs text-muted-foreground">
          {rows.length}/{LIMITS.headers}
        </span>
      </div>
      {rows.length > 0 && (
        <ul className="grid gap-2" aria-labelledby="headers-label">
          {rows.map((row, i) => {
            const nameErr = errors[`header-${i}-name`];
            const valueErr = errors[`header-${i}-value`];
            return (
              <li key={row.key} className="grid gap-1">
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <Input
                      {...describe(`header-${i}-name`, nameErr)}
                      aria-label={`Header ${i + 1} name`}
                      placeholder="Authorization"
                      value={row.name}
                      onChange={(e) => update(row.key, { name: e.target.value })}
                      className="font-mono text-xs md:text-xs"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Input
                      {...describe(`header-${i}-value`, valueErr)}
                      aria-label={`Header ${i + 1} value`}
                      placeholder="Bearer …"
                      value={row.value}
                      onChange={(e) => update(row.key, { value: e.target.value })}
                      className="font-mono text-xs md:text-xs"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove header ${row.name || i + 1}`}
                    onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                {(nameErr || valueErr) && (
                  <p className="text-xs font-medium text-destructive">
                    {nameErr && <span id={`header-${i}-name-error`}>{nameErr}</span>}
                    {nameErr && valueErr && " · "}
                    {valueErr && <span id={`header-${i}-value-error`}>{valueErr}</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={full}
          onClick={() => onChange([...rows, newHeaderRow()])}
        >
          <Plus aria-hidden="true" />
          Add header
        </Button>
      </div>
      {errors.headers && <p className="text-xs font-medium text-destructive">{errors.headers}</p>}
    </div>
  );
}

/** Chip input for tags: Enter or comma adds, Backspace on empty removes the last. */
export function TagsInput({
  id,
  tags,
  onChange,
  error,
  suggestions = [],
}: {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  error?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const full = tags.length >= LIMITS.tags;

  function commit(raw: string) {
    const parts = raw.split(",").map(normalizeTag).filter(Boolean);
    if (parts.length === 0) return true;
    const next = [...tags];
    for (const tag of parts) {
      if (!TAG_PATTERN.test(tag)) {
        setLocalError(`"${tag}" can only use a–z, 0–9, spaces, _ and - (max ${LIMITS.tagLength})`);
        return false;
      }
      if (next.length >= LIMITS.tags) {
        setLocalError(`Use at most ${LIMITS.tags} tags`);
        break;
      }
      if (!next.includes(tag)) next.push(tag);
    }
    onChange(next);
    setLocalError(null);
    return true;
  }

  const shownError = localError ?? error;
  const unused = suggestions.filter((s) => !tags.includes(s)).slice(0, 8);

  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
          shownError && "border-destructive"
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 items-center gap-1 rounded-md border bg-surface pl-2 pr-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          {...describe(id, shownError ?? undefined, true)}
          value={draft}
          disabled={full}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) {
              if (commit(v)) setDraft("");
              else setDraft(v.replace(/,/g, ""));
            } else {
              setDraft(v);
              setLocalError(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (commit(draft)) setDraft("");
            } else if (e.key === "Backspace" && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim() && commit(draft)) setDraft("");
          }}
          placeholder={full ? "Tag limit reached" : tags.length ? "Add another…" : "production, api, eu-west"}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          maxLength={40}
          autoComplete="off"
        />
      </div>
      {shownError ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {shownError}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Press Enter or comma to add. Up to {LIMITS.tags} tags, saved in lowercase.
        </p>
      )}
      {unused.length > 0 && !full && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Used before:</span>
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:border-solid hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
