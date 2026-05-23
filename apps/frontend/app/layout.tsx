import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {ClerkProvider} from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UptimeWatch",
  description: "UptimeWatch is an uptime and API monitoring platform. Add your websites and APIs, get checked every minute, and view real-time uptime, response time, and instant downtime email alerts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <ClerkProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
              <Header />
            {children}
          </body>
        </ThemeProvider>
      </ClerkProvider>
    </html>
  );
}
