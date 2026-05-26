"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle } from "lucide-react"

export function CtaSection() {
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [activeTab, setActiveTab] = useState("join")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulate form submission
    setTimeout(() => {
      setFormSubmitted(true)
    }, 500)
  }

  const resetForm = () => {
    setFormSubmitted(false)
  }

  return (
    <section id="join" className="mx-10 space-y-12 py-20 md:py-32">
      <div className="mx-auto grid gap-8 md:grid-cols-2 items-center">
        <div className="flex flex-col justify-center space-y-4">
          <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary w-fit">
            Get Started
          </div>
          <div className="space-y-2">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-4xl">
              Start Monitoring Your Sites Today
            </h2>
            <p className="text-muted-foreground max-w-md">
              Add your websites and APIs in seconds and let UptimeWatch keep an eye on them around the clock.
            </p>
          </div>

          <div className="space-y-4 mt-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Automated Checks</h4>
                <p className="text-sm text-muted-foreground">Every site is checked automatically, once a minute</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Response Time Insights</h4>
                <p className="text-sm text-muted-foreground">Track latency and uptime trends over time</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Instant Alerts</h4>
                <p className="text-sm text-muted-foreground">Get an email the moment a site goes down or recovers</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-8">
          <Tabs defaultValue="join" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="join">Create Account</TabsTrigger>
              <TabsTrigger value="monitor">Monitor Site</TabsTrigger>
            </TabsList>

            <TabsContent value="join">
              {formSubmitted ? (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold">You&apos;re All Set!</h3>
                  <p className="text-muted-foreground">
                    Thanks for signing up. Head to your dashboard to add your first site.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={resetForm}>
                    Create Another Account
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <h3 className="text-xl font-medium">Create Your Account</h3>
                    <p className="text-sm text-muted-foreground">
                      Sign up in seconds and start monitoring your sites right away.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" placeholder="Enter your name" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="Enter your email" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" placeholder="Create a password" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Create Account
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="monitor">
              {formSubmitted ? (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold">Site Added Successfully!</h3>
                  <p className="text-muted-foreground">
                    Your website has been added to our monitoring network. You will receive a confirmation email shortly.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={resetForm}>
                    Add Another Site
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <h3 className="text-xl font-medium">Add Your Website</h3>
                    <p className="text-sm text-muted-foreground">
                      Start monitoring your website with automated minute-by-minute checks.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="site-name">Website Name</Label>
                      <Input id="site-name" placeholder="My Awesome Website" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="site-url">Website URL</Label>
                      <Input id="site-url" type="url" placeholder="https://example.com" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="check-frequency">Check Frequency</Label>
                      <Select defaultValue="5">
                        <SelectTrigger id="check-frequency">
                          <SelectValue placeholder="Select check frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Every 1 minute</SelectItem>
                          <SelectItem value="5">Every 5 minutes</SelectItem>
                          <SelectItem value="15">Every 15 minutes</SelectItem>
                          <SelectItem value="30">Every 30 minutes</SelectItem>
                          <SelectItem value="60">Every hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email-alerts">Alert Email</Label>
                      <Input id="email-alerts" type="email" placeholder="alerts@example.com" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Start Monitoring
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  )
}

