"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useApiClient } from "@/hooks/useApiClient";
import type {
  AlertChannel,
  AlertChannelType,
  AnalyticsRange,
  BulkAction,
  CalendarDay,
  CheckNowResult,
  ChecksPage,
  Incident,
  IncidentFilter,
  IncidentsPage,
  IncidentUpdateStatus,
  Monitor,
  MonitorAnalytics,
  MonitorConfig,
  Overview,
  StatusPage,
} from "@/lib/api/types";

/** Checks run every minute, so refreshing faster than this is wasted work. */
const LIVE_REFRESH_MS = 30_000;

export const queryKeys = {
  overview: ["overview"] as const,
  monitors: ["monitors"] as const,
  monitor: (id: string) => ["monitors", id] as const,
  analytics: (id: string, range: AnalyticsRange) => ["monitors", id, "analytics", range] as const,
  calendar: (id: string) => ["monitors", id, "calendar"] as const,
  checks: (id: string, status?: string) => ["monitors", id, "checks", status ?? "all"] as const,
  monitorIncidents: (id: string) => ["monitors", id, "incidents"] as const,
  incidents: (filter: IncidentFilter, websiteId?: string) => ["incidents", filter, websiteId ?? "all"] as const,
  incident: (id: string) => ["incident", id] as const,
  alertChannels: ["alert-channels"] as const,
  statusPages: ["status-pages"] as const,
};

// ---- Overview ---------------------------------------------------------------

export function useOverview() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: async () => (await api.get<Overview>("/overview")).data,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

// ---- Monitors ---------------------------------------------------------------

export function useMonitors() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.monitors,
    queryFn: async () => (await api.get<{ websites: Monitor[] }>("/websites")).data.websites,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useMonitor(id: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.monitor(id),
    queryFn: async () => (await api.get<Monitor>(`/website/${id}`)).data,
    refetchInterval: LIVE_REFRESH_MS,
    enabled: Boolean(id),
  });
}

export function useMonitorAnalytics(id: string, range: AnalyticsRange) {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.analytics(id, range),
    queryFn: async () =>
      (await api.get<MonitorAnalytics>(`/website/${id}/analytics?range=${range}`)).data,
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useMonitorCalendar(id: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.calendar(id),
    queryFn: async () => (await api.get<{ days: CalendarDay[] }>(`/website/${id}/calendar`)).data.days,
    staleTime: 5 * 60_000,
  });
}

export function useMonitorChecks(id: string, status?: "UP" | "DOWN") {
  const api = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.checks(id, status),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) params.set("before", pageParam);
      if (status) params.set("status", status);
      return (await api.get<ChecksPage>(`/website/${id}/checks?${params}`)).data;
    },
    getNextPageParam: (last) => last.nextBefore,
    refetchInterval: 60_000,
  });
}

export function useMonitorIncidents(id: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.monitorIncidents(id),
    queryFn: async () =>
      (await api.get<{ incidents: Incident[] }>(`/website/${id}/incidents`)).data.incidents,
    refetchInterval: 60_000,
  });
}

function useInvalidateMonitors() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.monitors });
    qc.invalidateQueries({ queryKey: queryKeys.overview });
  }, [qc]);
}

export function useCreateMonitor() {
  const api = useApiClient();
  const invalidate = useInvalidateMonitors();
  return useMutation({
    mutationFn: async (input: Partial<MonitorConfig>) =>
      (await api.post<{ id: string }>("/website", input)).data,
    onSuccess: invalidate,
  });
}

export type MonitorUpdate = Partial<MonitorConfig> & { maintenanceUntil?: null; maintenanceMinutes?: number };

export function useUpdateMonitor(id: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  const invalidate = useInvalidateMonitors();
  return useMutation({
    mutationFn: async (input: MonitorUpdate) => (await api.patch<Monitor>(`/website/${id}`, input)).data,
    onSuccess: (monitor) => {
      // The PATCH response has no recent checks; keep the cached ones, then refetch.
      qc.setQueryData(queryKeys.monitor(id), (old: Monitor | undefined) =>
        old ? { ...old, ...monitor, websiteTicks: old.websiteTicks } : old
      );
      qc.invalidateQueries({ queryKey: queryKeys.monitor(id) });
      invalidate();
    },
  });
}

export function useCheckNow(id: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  const invalidate = useInvalidateMonitors();
  return useMutation({
    mutationFn: async () => (await api.post<CheckNowResult>(`/website/${id}/check`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors", id] });
      invalidate();
    },
  });
}

export function useRotateHeartbeatToken(id: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ heartbeatToken: string }>(`/website/${id}/heartbeat-token`)).data,
    onSuccess: ({ heartbeatToken }) =>
      qc.setQueryData(queryKeys.monitor(id), (old: Monitor | undefined) =>
        old ? { ...old, heartbeatToken } : old
      ),
  });
}

export function useDeleteMonitor() {
  const api = useApiClient();
  const qc = useQueryClient();
  const invalidate = useInvalidateMonitors();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/website/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData(queryKeys.monitors, (old: Monitor[] | undefined) => old?.filter((m) => m.id !== id));
      qc.removeQueries({ queryKey: queryKeys.monitor(id) });
      invalidate();
    },
  });
}

export function useBulkMonitors() {
  const api = useApiClient();
  const invalidate = useInvalidateMonitors();
  return useMutation({
    mutationFn: async (input: { ids: string[]; action: BulkAction; tag?: string }) =>
      (await api.post<{ updated: number }>("/websites/bulk", input)).data,
    onSuccess: invalidate,
  });
}

// ---- Incidents --------------------------------------------------------------

export function useIncidents(filter: IncidentFilter, websiteId?: string) {
  const api = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.incidents(filter, websiteId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ status: filter, limit: "30" });
      if (websiteId) params.set("websiteId", websiteId);
      if (pageParam) params.set("before", pageParam);
      return (await api.get<IncidentsPage>(`/incidents?${params}`)).data;
    },
    getNextPageParam: (last) => last.nextBefore,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useIncident(id: string | null) {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.incident(id ?? ""),
    queryFn: async () => (await api.get<Incident>(`/incidents/${id}`)).data,
    enabled: Boolean(id),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

function useIncidentMutationSuccess() {
  const qc = useQueryClient();
  return useCallback(
    (incident: Incident) => {
      qc.setQueryData(queryKeys.incident(incident.id), incident);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: queryKeys.monitorIncidents(incident.websiteId) });
      qc.invalidateQueries({ queryKey: queryKeys.overview });
    },
    [qc]
  );
}

export function useAcknowledgeIncident() {
  const api = useApiClient();
  const onSuccess = useIncidentMutationSuccess();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Incident>(`/incidents/${id}/acknowledge`)).data,
    onSuccess,
  });
}

export function usePostIncidentUpdate(id: string) {
  const api = useApiClient();
  const onSuccess = useIncidentMutationSuccess();
  return useMutation({
    mutationFn: async (input: { message: string; status: IncidentUpdateStatus; public: boolean }) =>
      (await api.post<Incident>(`/incidents/${id}/updates`, input)).data,
    onSuccess,
  });
}

// ---- CSV export -------------------------------------------------------------

/** Download an authenticated CSV endpoint as a file. */
export function useCsvDownload() {
  const api = useApiClient();
  return useCallback(
    async (path: string, filename: string) => {
      const res = await api.get<Blob>(path, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [api]
  );
}

// ---- Alert channels ---------------------------------------------------------

export function useAlertChannels() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.alertChannels,
    queryFn: async () => (await api.get<{ channels: AlertChannel[] }>("/alert-channels")).data.channels,
  });
}

export function useCreateAlertChannel() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: AlertChannelType; name?: string; target: string; chatId?: string }) =>
      (await api.post<AlertChannel>("/alert-channels", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alertChannels }),
  });
}

export function useUpdateAlertChannel() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; enabled?: boolean; name?: string }) =>
      (await api.patch<AlertChannel>(`/alert-channels/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alertChannels }),
  });
}

export function useDeleteAlertChannel() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/alert-channels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alertChannels }),
  });
}

export function useTestAlertChannel() {
  const api = useApiClient();
  return useMutation({
    mutationFn: async (id: string) => api.post(`/alert-channels/${id}/test`),
  });
}

// ---- Status pages -----------------------------------------------------------

export function useStatusPages() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.statusPages,
    queryFn: async () => (await api.get<{ statusPages: StatusPage[] }>("/status-pages")).data.statusPages,
  });
}

export type StatusPageInput = Pick<
  StatusPage,
  | "slug"
  | "title"
  | "description"
  | "websiteIds"
  | "published"
  | "logoUrl"
  | "accentColor"
  | "announcement"
  | "showIncidentHistory"
>;

export function useSaveStatusPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<StatusPageInput> & { id?: string }) =>
      id
        ? (await api.patch<StatusPage>(`/status-pages/${id}`, input)).data
        : (await api.post<StatusPage>("/status-pages", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.statusPages }),
  });
}

export function useDeleteStatusPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/status-pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.statusPages }),
  });
}
