"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { useInView } from "framer-motion"
import { Activity, BarChart, Bell, Globe, Lock, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface FeatureCardProps {
  title: string
  description: string
  icon: React.ReactNode
  index: number
  isInView: boolean
}

function FeatureCard({ title, description, icon, index, isInView }: FeatureCardProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    if (isInView && !animated) {
      const timer = setTimeout(() => {
        setAnimated(true)
      }, index * 100)
      return () => clearTimeout(timer)
    }
  }, [isInView, index, animated])

  return (
    <Card
      className={`group transition-all hover:shadow-md ${
        animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{
        transitionProperty: "all",
        transitionDuration: "0.5s",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-all group-hover:scale-110 group-hover:bg-primary/20">
          {icon}
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export function FeaturesSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })

  const features = [
    {
      title: "Checks every minute",
      description:
        "HTTP checks from every minute to once a day, with custom methods, expected status codes, timeouts and keyword matching.",
      icon: <Activity className="h-6 w-6 text-primary" aria-hidden="true" />,
    },
    {
      title: "No false alarms",
      description:
        "Alerts fire only after consecutive failures, and every incident says why: DNS, timeout, TLS, status code or missing keyword.",
      icon: <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />,
    },
    {
      title: "Alerts where you work",
      description: "Email, Slack, Discord or any webhook, the moment something breaks and again when it recovers.",
      icon: <Bell className="h-6 w-6 text-primary" aria-hidden="true" />,
    },
    {
      title: "Public status pages",
      description: "Share a live status page with 90 days of uptime history so users know what's happening.",
      icon: <Globe className="h-6 w-6 text-primary" aria-hidden="true" />,
    },
    {
      title: "SSL expiry warnings",
      description: "Get warned 30, 14, 7 and 1 day before a certificate expires, before browsers start blocking visitors.",
      icon: <Lock className="h-6 w-6 text-primary" aria-hidden="true" />,
    },
    {
      title: "Response time analytics",
      description: "Average, p95 and p99 latency over 24 hours, 7 days or 30 days, plus on-demand PageSpeed reports.",
      icon: <BarChart className="h-6 w-6 text-primary" aria-hidden="true" />,
    },
  ]

  return (
    <section id="features" className="py-20 md:py-32 bg-muted/30 dark:bg-muted/10" ref={ref}>
      <div className="mx-10">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            Features
          </div>
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl">Key Features</h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Our platform offers a comprehensive set of features to ensure your online presence is always monitored.
          </p>
        </div>

        <div className="mx-auto mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>

        <div className="mt-20 rounded-lg border bg-card p-8 md:p-12">
          <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            <div>
              <h3 className="text-2xl font-bold">Why UptimeWatch</h3>
              <p className="mt-2 text-muted-foreground">
                Everything you need to stay on top of your sites — without checking them yourself.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium">Capability</div>
                <div className="font-medium text-primary">UptimeWatch</div>
                <div className="font-medium text-muted-foreground">Manual Checks</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
                <div>Check Frequency</div>
                <div className="text-green-500 dark:text-green-400">Every minute</div>
                <div className="text-amber-500 dark:text-amber-400">Rarely</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
                <div>Response Time Tracking</div>
                <div className="text-green-500 dark:text-green-400">Yes</div>
                <div className="text-red-500 dark:text-red-400">No</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
                <div>Downtime Alerts</div>
                <div className="text-green-500 dark:text-green-400">Instant</div>
                <div className="text-red-500 dark:text-red-400">None</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
                <div>Incident History</div>
                <div className="text-green-500 dark:text-green-400">Yes</div>
                <div className="text-red-500 dark:text-red-400">No</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

