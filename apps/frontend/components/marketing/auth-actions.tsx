"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Primary CTA: "Start monitoring" when signed out, "Open dashboard" when signed in. */
export function PrimaryCta({ size = "lg", className }: { size?: "default" | "lg"; className?: string }) {
  const cls = cn(size === "lg" ? "h-11 px-5 text-[15px]" : "h-9", className);
  return (
    <>
      <SignedOut>
        <SignUpButton mode="modal" forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
          <Button className={cls}>
            Start monitoring
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Button asChild className={cls}>
          <Link href="/dashboard">
            Open dashboard
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </SignedIn>
    </>
  );
}

/** Header auth controls. */
export function HeaderAuth({ stacked = false }: { stacked?: boolean }) {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal" forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
          <Button variant="ghost" className={cn("h-9", stacked && "w-full justify-center")}>
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal" forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
          <Button className={cn("h-9", stacked && "w-full justify-center")}>Start monitoring</Button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Button asChild className={cn("h-9", stacked && "w-full justify-center")}>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </SignedIn>
    </>
  );
}
