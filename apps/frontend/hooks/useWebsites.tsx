"use client"
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BACKEND_URL, CLERK_JWT_TEMPLATE } from "@/config";

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

    async function refreshWebsites() {
        const token = await getToken(
            CLERK_JWT_TEMPLATE ? { template: CLERK_JWT_TEMPLATE } : undefined
        );
        if (!token) return;

        const res = await axios.get(`${API_BACKEND_URL}/api/v1/websites`, {
            headers: {
                Authorization: `Bearer ${token}`, 
            }
        })
        
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
