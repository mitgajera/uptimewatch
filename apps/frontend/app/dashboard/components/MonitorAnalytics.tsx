"use client";
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import { API_BACKEND_URL } from '@/config';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WebsiteAnalytics, Incident } from './types';

const RANGES = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function MetricPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center border border-gray-100 dark:border-zinc-700">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

export function MonitorAnalytics({ websiteId }: { websiteId: string }) {
  const { getToken } = useAuth();
  const [range, setRange] = useState('24h');
  const [analytics, setAnalytics] = useState<WebsiteAnalytics | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [a, inc] = await Promise.all([
        axios.get(`${API_BACKEND_URL}/api/v1/website/${websiteId}/analytics?range=${range}`, { headers }),
        axios.get(`${API_BACKEND_URL}/api/v1/website/${websiteId}/incidents`, { headers }),
      ]);
      setAnalytics(a.data);
      setIncidents(inc.data.incidents);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  }, [websiteId, range, getToken]);

  useEffect(() => { load(); }, [load]);

  const chartData = (analytics?.series || []).map((p) => ({
    time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    latency: p.avgLatency,
  }));

  return (
    <div className="mt-4 space-y-4">
      {/* Range selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Range:</span>
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`text-xs px-2.5 py-1 rounded-md transition ${
              range === r.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && !analytics ? (
        <div className="h-40 rounded-lg bg-gray-50 dark:bg-zinc-800 animate-pulse" />
      ) : analytics ? (
        <>
          {/* Latency metrics */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <MetricPill label="Uptime" value={`${analytics.uptime}%`} />
            <MetricPill label="Avg" value={`${analytics.latency.avg}ms`} />
            <MetricPill label="P50" value={`${analytics.latency.p50}ms`} />
            <MetricPill label="P95" value={`${analytics.latency.p95}ms`} sub="95th pct" />
            <MetricPill label="P99" value={`${analytics.latency.p99}ms`} sub="99th pct" />
            <MetricPill label="Checks" value={String(analytics.totalChecks)} />
          </div>

          {/* Response time chart */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Response time (ms)</p>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8882" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelStyle={{ fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="latency" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Not enough data yet — checks run every minute.</p>
            )}
          </div>

          {/* Incident history */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Incident history</p>
            {incidents.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">No incidents recorded. 🎉</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                {incidents.map((i) => (
                  <li key={i.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${i.ongoing ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                      <span className="text-gray-700 dark:text-gray-300">
                        {new Date(i.startedAt).toLocaleString()}
                      </span>
                      {i.lastStatusCode && (
                        <span className="text-gray-400">HTTP {i.lastStatusCode}</span>
                      )}
                    </div>
                    <span className={i.ongoing ? 'text-red-500 font-medium' : 'text-gray-500'}>
                      {i.ongoing ? 'Ongoing' : fmtDuration(i.durationMs)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400">Could not load analytics.</p>
      )}
    </div>
  );
}
