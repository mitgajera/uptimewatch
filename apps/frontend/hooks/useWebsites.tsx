"use client"
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BACKEND_URL } from "@/config";

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
    const {getToken } = useAuth()
    const [websites, setWebsites] = useState<Website[]>([])
    const [error, setError] = useState<string | null>(null)

    async function refreshWebsites() {
        try {
            const token = await getToken();

            const res = await axios.get(`${API_BACKEND_URL}/api/v1/websites`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            })

            setWebsites(res.data.websites)
            setError(null)
        } catch (err) {
            // Don't let a failed poll bubble up as an unhandled rejection and
            // silently stop the refresh loop — surface it so callers can react.
            console.error("Failed to load websites:", err)
            setError("Failed to load websites.")
        }
    }

    useEffect(() => {
        refreshWebsites();

        const interval = setInterval(() => {
            refreshWebsites();
        }, 1000 * 60 * 1);

        return () => clearInterval(interval);
    }, [])

    return {websites, refreshWebsites, error};
}
