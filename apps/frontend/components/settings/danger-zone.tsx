"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "./settings-card";

export function DangerZone() {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);
    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      toast.error("Could not sign out. Try again.");
      setPending(false);
    }
  }

  return (
    <SettingsSection
      id="danger"
      title="Danger zone"
      tone="danger"
      description="Monitoring keeps running."
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Sign out</p>
          <p className="text-xs text-muted-foreground">To delete your account, use Manage account above.</p>
        </div>
        <Button
          variant="outline"
          className="h-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onSignOut}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
          Sign out
        </Button>
      </div>
    </SettingsSection>
  );
}
