"use client"
import { useEffect, useState } from "react";
import { useApiClient } from "@/hooks/useApiClient";

interface Website {
    id: string;
    url: string;
    name?: string;
    userId: string;
    disabled: boolean;
    isDown?: boolean;
    websiteTicks: {
        id: string;
        websiteId: string;
        createdAt: string;
        updatedAt: string;
        status: string;
        latency: number;
        statusCode?: number | null;
    }[];
}

export function useWebsites() {
    const api = useApiClient()
    const [websites, setWebsites] = useState<Website[]>([])

    async function refreshWebsites() {
        const res = await api.get<{ websites: Website[] }>("/websites")
        setWebsites(res.data.websites)
    }

    useEffect(() => {
        refreshWebsites();

        const interval = setInterval(() => {
            refreshWebsites();
        }, 1000 * 60 * 1);

        return () => clearInterval(interval);
    }, [])

    return {websites, refreshWebsites};
}
