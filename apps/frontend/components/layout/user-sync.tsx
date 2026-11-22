"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useApiClient } from "@/hooks/useApiClient";

/**
 * Copies the signed-in user's name and primary email to the API so alerts can
 * fall back to the account email. Runs once per browser session per user.
 * Renders nothing.
 */
export function UserSync() {
  const { user, isLoaded } = useUser();
  const api = useApiClient();

  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    if (!email) return;

    const key = `uw-synced:${user.id}:${email}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Storage blocked: sync anyway, it is idempotent.
    }

    let cancelled = false;
    api
      .post("/user/sync", { name: user.fullName || user.username || "", email })
      .then(() => {
        if (cancelled) return;
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        // Non-fatal: the next page load retries.
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user, api]);

  return null;
}
