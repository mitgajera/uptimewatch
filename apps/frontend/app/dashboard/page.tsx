"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Plus } from 'lucide-react';
import { useWebsites } from '@/hooks/useWebsites';
import axios from 'axios';
import { useApiClient } from '@/hooks/useApiClient';
import { WebsiteCard } from './components/WebsiteCard';
import { AddWebsiteModal } from './components/AddWebsiteModal';
import { StatsBar } from './components/StatsBar';
import { DashboardStats } from './components/types';

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { websites, refreshWebsites, error: websitesError } = useWebsites();
  const api = useApiClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await api.get<DashboardStats>('/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [api]);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  const handleAddWebsite = async ({ url, name }: { name: string; url: string }) => {
    try {
      await api.post('/website', { url, name });
      setIsModalOpen(false);
      refreshWebsites();
      refreshStats();
    } catch (error) {
      console.error('Error adding website:', error);
      alert(axios.isAxiosError(error) ? (error.response?.data?.message || 'Failed to add website') : 'Failed to add website');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Globe className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monitor your websites and APIs in real time</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-black transition"
          >
            <Plus className="w-5 h-5" />
            Add Monitor
          </button>
        </div>

        <StatsBar stats={stats} loading={!stats} />

        {websitesError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {websitesError}
          </div>
        )}

        {websites.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
            <Globe className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No monitors yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
              Add your first website or API to start tracking uptime.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Add your first monitor
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {websites.map((website) => (
              <WebsiteCard
                key={website.id}
                website={website}
                onDelete={() => { refreshWebsites(); refreshStats(); }}
              />
            ))}
          </div>
        )}
      </div>

      <AddWebsiteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddWebsite}
      />
    </div>
  );
}
