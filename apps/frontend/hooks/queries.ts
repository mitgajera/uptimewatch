"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/useApiClient";
import type {
  AlertChannel,
  AlertChannelType,
  AnalyticsRange,
  DashboardStats,
  Incident,
  Monitor,
  MonitorAnalytics,
  MonitorConfig,
  StatusPage,
} from "@/lib/api/types";

/** Checks run every minute, so refreshing faster than this is wasted work. */
const LIVE_REFRESH_MS = 30_000;

export const queryKeys = {
  monitors: ["monitors"] as const,
  monitor: (id: string) => ["monitors", id] as const,
  analytics: (id: string, range: AnalyticsRange) => ["monitors", id, "analytics", range] as const,
  incidents: (id: string) => ["monitors", id, "incidents"] as const,
  stats: ["stats"] as const,
  alertChannels: ["alert-channels"] as const,
  statusPages: ["status-pages"] as const,
};

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
  });
}

export function useDashboardStats() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => (await api.get<DashboardStats>("/stats")).data,
    refetchInterval: LIVE_REFRESH_MS,
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

export function useMonitorIncidents(id: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.incidents(id),
    queryFn: async () =>
      (await api.get<{ incidents: Incident[] }>(`/website/${id}/incidents`)).data.incidents,
    refetchInterval: 60_000,
  });
}

export function useCreateMonitor() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MonitorConfig>) =>
      (await api.post<{ id: string }>("/website", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.monitors });
      qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUpdateMonitor(id: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MonitorConfig>) =>
      (await api.patch<Monitor>(`/website/${id}`, input)).data,
    onSuccess: (monitor) => {
      qc.setQueryData(queryKeys.monitor(id), (old: Monitor | undefined) => ({ ...old, ...monitor }));
      qc.invalidateQueries({ queryKey: queryKeys.monitors });
      qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteMonitor() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/website/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData(queryKeys.monitors, (old: Monitor[] | undefined) =>
        old?.filter((m) => m.id !== id)
      );
      qc.removeQueries({ queryKey: queryKeys.monitor(id) });
      qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ---- Alert channels -----------------------------------------------------------

export function useAlertChannels() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.alertChannels,
    queryFn: async () =>
      (await api.get<{ channels: AlertChannel[] }>("/alert-channels")).data.channels,
  });
}

export function useCreateAlertChannel() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: AlertChannelType; name?: string; target: string }) =>
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

// ---- Status pages ---------------------------------------------------------------

export function useStatusPages() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.statusPages,
    queryFn: async () =>
      (await api.get<{ statusPages: StatusPage[] }>("/status-pages")).data.statusPages,
  });
}

type StatusPageInput = Pick<StatusPage, "slug" | "title" | "description" | "websiteIds" | "published">;

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
