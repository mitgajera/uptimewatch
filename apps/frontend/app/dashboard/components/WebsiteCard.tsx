import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Power, AreaChart } from "lucide-react";
import axios from "axios";
import { useApiClient } from "@/hooks/useApiClient";
import { Website } from "./types";
import { StatusCircle } from "./StatusCircle";
import { UptimeGraph } from "./UptimeGraph";
import { MonitorAnalytics } from "./MonitorAnalytics";
import {
  aggregateTicksToWindows,
  calculateUptimePercentage,
  isValidURL,
  statusLabel,
  statusTextColor,
} from "./utils";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageSpeedInsightsModal } from "./PageSpeedInsightsModal";

interface WebsiteCardProps {
  website: Website;
  onDelete: () => void;
}

export function WebsiteCard({ website, onDelete }: WebsiteCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const api = useApiClient();

  const aggregatedUptime = useMemo(
    () =>
      website.websiteTicks
        ? aggregateTicksToWindows(
            website.websiteTicks.map((tick) => ({
              createdAt: tick.createdAt,
              status: tick.status,
            }))
          )
        : [],
    [website.websiteTicks]
  );

  const uptimePercentage = useMemo(
    () => calculateUptimePercentage(aggregatedUptime),
    [aggregatedUptime]
  );

  const currentStatus =
    aggregatedUptime.length > 0 ? aggregatedUptime[aggregatedUptime.length - 1] : "unknown";

  const hostname = website.url && isValidURL(website.url) ? new URL(website.url).hostname : "Invalid URL";
  const websiteName = website.name?.trim() || hostname;

  const lastCheckTime =
    website.websiteTicks && website.websiteTicks.length > 0
      ? new Date(website.websiteTicks[0].createdAt).toLocaleTimeString()
      : "Never";

  const lastLatency =
    website.websiteTicks && website.websiteTicks.length > 0
      ? Math.round(website.websiteTicks[0].latency)
      : null;

  async function handleDeleteWebsite(websiteId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this website?");
    if (!confirmed) return;

    try {
      await api.delete(`/website/${websiteId}`);
      onDelete();
    } catch (error) {
      console.error("Error deleting website:", error);
      alert(
        axios.isAxiosError(error)
          ? error.response?.data?.error || "Failed to delete website"
          : "Failed to delete website"
      );
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
          <StatusCircle status={currentStatus} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{websiteName}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{website.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastLatency != null && (
            <span className="hidden sm:inline text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">
              {lastLatency} ms
            </span>
          )}
          <span className={`text-sm font-medium ${statusTextColor(currentStatus)}`}>
            {uptimePercentage}% Uptime
          </span>
          <Dialog open={insightOpen} onOpenChange={setInsightOpen}>
            <DialogTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInsightOpen(true);
                }}
                className="text-blue-500 hover:text-blue-600 cursor-pointer"
                title="View PageSpeed Insights"
              >
                <AreaChart size={28} />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="pt-2 pl-2">PageSpeed Insights</DialogTitle>
              </DialogHeader>
              <PageSpeedInsightsModal url={website.url} />
            </DialogContent>
          </Dialog>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteWebsite(website.id);
            }}
            className="text-red-500 hover:text-red-600 cursor-pointer"
            title="Disable website"
          >
            <Power size={30} />
          </button>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-300" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-300" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-zinc-700">
          <div className="mt-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Website Status</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Last check: {lastCheckTime}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <p className={`text-sm font-medium ${statusTextColor(currentStatus)}`}>
                  {statusLabel(currentStatus)}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">Uptime</p>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{uptimePercentage}%</p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">Checks</p>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {website.websiteTicks?.length || 0}
                </p>
              </div>
            </div>
            <UptimeGraph uptime={aggregatedUptime} />
            <MonitorAnalytics websiteId={website.id} />
          </div>
        </div>
      )}
    </div>
  );
}
