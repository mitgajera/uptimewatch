"use client";
import { Activity, ArrowDownCircle, ArrowUpCircle, Gauge, AlertTriangle, Server } from 'lucide-react';
import { DashboardStats } from './types';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}

function StatCard({ label, value, icon, accent = 'text-blue-600' }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm flex items-center gap-3">
      <div className={`${accent} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}

export function StatsBar({ stats, loading }: { stats: DashboardStats | null; loading?: boolean }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[76px] bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      <StatCard label="Monitors" value={String(stats.totalMonitors)} icon={<Server className="w-6 h-6" />} accent="text-blue-600" />
      <StatCard label="Up" value={String(stats.up)} icon={<ArrowUpCircle className="w-6 h-6" />} accent="text-green-600" />
      <StatCard label="Down" value={String(stats.down)} icon={<ArrowDownCircle className="w-6 h-6" />} accent="text-red-600" />
      <StatCard label="Uptime (24h)" value={`${stats.avgUptime}%`} icon={<Activity className="w-6 h-6" />} accent="text-emerald-600" />
      <StatCard label="Avg Response" value={`${stats.avgResponseTime} ms`} icon={<Gauge className="w-6 h-6" />} accent="text-indigo-600" />
      <StatCard label="Active Incidents" value={String(stats.activeIncidents)} icon={<AlertTriangle className="w-6 h-6" />} accent={stats.activeIncidents > 0 ? 'text-amber-500' : 'text-gray-400'} />
    </div>
  );
}
