"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONITOR_TYPES, type MonitorType } from "@/lib/api/types";
import { SORT_OPTIONS, STATUS_FILTERS, type ListFilters, type SortKey, type StatusFilter } from "./utils";

const DEFAULTS: ListFilters = { q: "", status: "all", type: "all", tags: [], sort: "status" };

/** List filters persisted in the URL query (?q=&status=&type=&tags=a,b&sort=). */
export function useListFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<ListFilters>(() => {
    const status = params.get("status") as StatusFilter | null;
    const type = params.get("type") as MonitorType | null;
    const sort = params.get("sort") as SortKey | null;
    return {
      q: params.get("q") ?? "",
      status: status && STATUS_FILTERS.some((s) => s.value === status) ? status : DEFAULTS.status,
      type: type && MONITOR_TYPES.includes(type) ? type : DEFAULTS.type,
      tags: (params.get("tags") ?? "").split(",").filter(Boolean),
      sort: sort && SORT_OPTIONS.some((s) => s.value === sort) ? sort : DEFAULTS.sort,
    };
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<ListFilters>) => {
      const next = { ...filters, ...patch };
      const qs = new URLSearchParams();
      if (next.q.trim()) qs.set("q", next.q);
      if (next.status !== DEFAULTS.status) qs.set("status", next.status);
      if (next.type !== DEFAULTS.type) qs.set("type", next.type);
      if (next.tags.length) qs.set("tags", next.tags.join(","));
      if (next.sort !== DEFAULTS.sort) qs.set("sort", next.sort);
      const query = qs.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [filters, pathname, router]
  );

  const clearFilters = useCallback(
    () => setFilters({ q: "", status: "all", type: "all", tags: [] }),
    [setFilters]
  );

  const active =
    filters.q.trim() !== "" || filters.status !== "all" || filters.type !== "all" || filters.tags.length > 0;

  return { filters, setFilters, clearFilters, active };
}
