"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "./settings-card";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function AccountSection() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? "";
  const name = user?.fullName || user?.username || email.split("@")[0] || "Your account";

  return (
    <SettingsSection
      id="account"
      title="Account"
      description="Alerts fall back to this email."
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {!isLoaded ? (
          <div className="flex flex-1 items-center gap-3" aria-hidden="true">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="size-12 ring-1 ring-border">
              {user?.imageUrl && <AvatarImage src={user.imageUrl} alt="" />}
              <AvatarFallback className="text-sm font-medium">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              {user?.createdAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Member since{" "}
                  <span className="numeric">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
        <Button variant="outline" className="h-9 sm:self-center" onClick={() => openUserProfile()} disabled={!isLoaded}>
          <UserCog className="size-4" aria-hidden="true" />
          Manage account
        </Button>
      </div>
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">
        Change your name, email, password, connected logins and active sessions in the account manager.
      </p>
    </SettingsSection>
  );
}
