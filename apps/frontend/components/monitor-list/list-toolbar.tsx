"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Check, Search, Tag, X } from "lucide-react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonitorTypeIcon } from "@/components/app/status";
import { MONITOR_TYPES, type MonitorType } from "@/lib/api/types";
import { TYPE_LABEL } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, STATUS_FILTERS, type ListFilters, type SortKey, type StatusFilter } from "./utils";

const STATUS_DOT: Partial<Record<StatusFilter, string>> = {
  down: "bg-destructive",
  degraded: "bg-warning",
  up: "bg-success",
  paused: "bg-muted-foreground/60",
  maintenance: "bg-info",
};

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [q, setQ] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const pushed = useRef(value);

  // Pick up external changes (e.g. "Clear filters") without clobbering typing.
  useEffect(() => {
    if (value !== pushed.current) {
      pushed.current = value;
      setQ(value);
    }
  }, [value]);

  useEffect(() => {
    if (q === pushed.current) return;
    const t = setTimeout(() => {
      pushed.current = q;
      onChange(q);
    }, 200);
    return () => clearTimeout(t);
  }, [q, onChange]);

  // "/" focuses search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <label htmlFor="monitor-search" className="sr-only">
        Search monitors
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        id="monitor-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && q) {
            e.preventDefault();
            setQ("");
          }
        }}
        placeholder="Search name, URL or tag"
        autoComplete="off"
        className="h-9 bg-card pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {q ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:block"
        >
          /
        </kbd>
      )}
    </div>
  );
}

function StatusSegments({
  value,
  counts,
  onChange,
}: {
  value: StatusFilter;
  counts: Record<StatusFilter, number>;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToggleGroupPrimitive.Root
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as StatusFilter)}
        aria-label="Filter by status"
        className="inline-flex h-9 items-center gap-0.5 rounded-lg border bg-muted/60 p-0.5"
      >
        {STATUS_FILTERS.map((s) => {
          const count = counts[s.value];
          const dim = s.value !== "all" && count === 0;
          return (
            <ToggleGroupPrimitive.Item
              key={s.value}
              value={s.value}
              className={cn(
                "inline-flex h-full shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs",
                dim && "text-muted-foreground/60"
              )}
            >
              {STATUS_DOT[s.value] && (
                <span className={cn("size-1.5 rounded-full", STATUS_DOT[s.value], dim && "opacity-40")} aria-hidden="true" />
              )}
              {s.label}
              <span
                className={cn(
                  "numeric rounded px-1 text-[11px] text-muted-foreground",
                  s.value === "down" && count > 0 && "bg-destructive/10 text-destructive"
                )}
              >
                {count}
              </span>
            </ToggleGroupPrimitive.Item>
          );
        })}
      </ToggleGroupPrimitive.Root>
    </div>
  );
}

function TagFilter({
  tags,
  selected,
  onChange,
}: {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const toggle = (t: string) =>
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9 bg-card", selected.length > 0 && "border-foreground/30")}>
          <Tag className="size-4" aria-hidden="true" />
          Tags
          {selected.length > 0 && (
            <span className="numeric rounded bg-foreground px-1.5 text-[11px] text-background">{selected.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput placeholder="Filter tags…" />
          <CommandList>
            <CommandEmpty>{tags.length ? "No matching tags." : "No tags yet. Add tags to monitors to group them."}</CommandEmpty>
            {tags.length > 0 && (
              <CommandGroup>
                {tags.map((t) => {
                  const on = selected.includes(t);
                  return (
                    <CommandItem key={t} value={t} onSelect={() => toggle(t)}>
                      <span
                        className={cn(
                          "grid size-4 place-items-center rounded-sm border",
                          on ? "border-foreground bg-foreground text-background" : "border-muted-foreground/40"
                        )}
                        aria-hidden="true"
                      >
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="truncate">{t}</span>
                      <span className="sr-only">{on ? "(selected)" : ""}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => onChange([])}>
                Clear tags
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const current = SORT_OPTIONS.find((s) => s.value === value)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 bg-card" aria-label={`Sort by ${current.label}`}>
          <ArrowDownUp className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as SortKey)}>
          {SORT_OPTIONS.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value} className="justify-between gap-3">
              <span>{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ListToolbar({
  filters,
  setFilters,
  counts,
  tags,
}: {
  filters: ListFilters;
  setFilters: (patch: Partial<ListFilters>) => void;
  counts: Record<StatusFilter, number>;
  tags: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={filters.q} onChange={(q) => setFilters({ q })} />
        <div className="flex items-center gap-2">
          <Select value={filters.type} onValueChange={(v) => setFilters({ type: v as MonitorType | "all" })}>
            <SelectTrigger className="h-9 w-[9.5rem] bg-card" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MONITOR_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  <span className="flex items-center gap-2">
                    <MonitorTypeIcon type={t} className="text-muted-foreground" />
                    {TYPE_LABEL[t]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TagFilter tags={tags} selected={filters.tags} onChange={(t) => setFilters({ tags: t })} />
          <SortMenu value={filters.sort} onChange={(sort) => setFilters({ sort })} />
        </div>
      </div>
      <StatusSegments value={filters.status} counts={counts} onChange={(status) => setFilters({ status })} />
    </div>
  );
}
