"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs"
import axios from "axios"
import { useAuth } from "@clerk/nextjs";
import { useUser } from '@clerk/nextjs';

const NavLinks = ({ onClick }: { onClick?: () => void }) => (
  <>
    {["features", "how-it-works", "testimonials"].map((item) => (
      <Link
        key={item}
        href={`#${item}`}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        onClick={onClick}
      >
        {item.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Link>
    ))}
  </>
)

export function Header() {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { getToken } = useAuth()
  const { user, isLoaded } = useUser()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Sync the signed-in Clerk user into our backend so we can email them alerts.
  useEffect(() => {
    const syncUser = async () => {
      const token = await getToken();
      if (!token || !user) return;

      try {
        await axios.post(`${process.env.NEXT_PUBLIC_API_BACKEND_URL}/api/v1/user/sync`, {
          name: user.fullName || user.username || '',
          email: user.emailAddresses[0]?.emailAddress || '',
        }, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.error("Failed to sync user:", err);
      }
    };

    if (isLoaded && user) {
      syncUser();
    }
  }, [isLoaded, user, getToken])

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200 ${
        isScrolled ? "shadow-sm" : ""
      }`}
    >
      <div className="px-4 sm:px-6 lg:px-10 flex h-16 items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4 sm:gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2 group">
            <Shield className="h-6 w-6 text-primary transition-transform group-hover:scale-110" />
            <span className="inline-block font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              UptimeWatch
            </span>
          </Link>

          {pathname === "/" && (
            <nav className="hidden md:flex gap-4 sm:gap-6">
              <NavLinks />
            </nav>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <ThemeToggle />

          {/* Dashboard CTA */}
          {pathname === "/" && (
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105"
            >
              <Link href="/dashboard">
                Go to Dashboard
              </Link>
            </Button>
          )}

          {/* Auth Buttons */}
          <div className="hidden sm:flex items-center gap-2">
            <SignedOut>
              <SignInButton>
                <button className="px-3 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition hover:scale-105">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="px-3 py-2 text-sm font-medium bg-gradient-to-r from-primary to-purple-500 text-white rounded-xl hover:from-primary/90 hover:to-purple-500/90 hover:scale-105 transition-all duration-300">
                  Sign Up
                </button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden hover:bg-secondary/50"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isMobileMenuOpen && pathname === "/" && (
        <div className="sm:hidden border-t px-4 py-4 space-y-4">
          <nav className="flex flex-col gap-4">
            <NavLinks onClick={() => setIsMobileMenuOpen(false)} />

            <Button
              asChild
              size="sm"
              className="w-full bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white"
            >
              <Link href="/dashboard">
                Go to Dashboard
              </Link>
            </Button>

            <SignedOut>
              <SignInButton>
                <button className="w-full px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="w-full px-4 py-2 text-sm font-medium bg-gradient-to-r from-primary to-purple-500 text-white rounded-xl hover:from-primary/90 hover:to-purple-500/90 transition">
                  Sign Up
                </button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UserButton />
            </SignedIn>
          </nav>
        </div>
      )}
    </header>
  )
}
