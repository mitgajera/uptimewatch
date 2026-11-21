# 🌐 UptimeWatch

**UptimeWatch** is a full-stack **uptime & API monitoring platform**. Add websites, APIs and cron jobs; UptimeWatch checks them on a schedule, records response time and failures, alerts you where you work, and publishes a status page for your users.

---

## 🚀 Features

- 🔍 **HTTP monitoring** – Checks every 1 min to 24 h with custom method, timeout, expected status codes (`200-299,301`), required keyword, and safe redirect following.
- 💓 **Heartbeat monitoring** – Cron jobs and backups ping a secret URL; you're alerted when a ping is overdue.
- 🧠 **No false alarms** – Incidents open only after N consecutive failures, and every failure is classified (DNS, timeout, connection, TLS, HTTP status, keyword, missed heartbeat).
- 🚨 **Alerts** – Email, Slack, Discord and generic webhooks, with test-send and retries. Falls back to your account email.
- 🔐 **SSL expiry warnings** – At 30, 14, 7 and 1 days before a certificate expires.
- 🌍 **Public status pages** – `/status/<slug>` with 90-day uptime bars, recent incidents and an embeddable SVG badge.
- 🛠️ **Maintenance windows** – Suspend checks and alerts for planned work; status pages show "under maintenance".
- 📊 **Analytics** – Uptime and p50/p95/p99 latency over 24 h, 7 d and 30 d, plus on-demand PageSpeed Insights.
- 🌓 **Dark/light UI** – Next.js + Tailwind + shadcn/ui.

---

## 🛠️ Tech Stack

| Layer      | Tech                                                   |
|------------|--------------------------------------------------------|
| Frontend   | Next.js (App Router), React, TanStack Query, Tailwind, shadcn/ui |
| Backend    | Express 5 on Bun, zod validation, helmet, rate limiting |
| Database   | MongoDB, Mongoose                                      |
| Auth       | Clerk (JWTs verified via JWKS)                         |
| Jobs       | node-cron with Mongo leases (single runner per job)    |
| Email      | Resend                                                 |
| Monorepo   | Turborepo, Bun workspaces                              |

---

## 📦 Monorepo Structure

```
apps/
├── api/            # Express API, background jobs and worker
│   ├── app.ts      #   HTTP app (routes, middleware)
│   ├── index.ts    #   API server (also runs jobs unless RUN_SCHEDULERS=false)
│   ├── worker.ts   #   standalone background worker
│   ├── monitor/    #   check engine: HTTP checks, heartbeats, SSL, transitions, alerts
│   ├── notify/     #   alert channels and delivery
│   ├── jobs/       #   scheduler + Mongo leases
│   └── tests/      #   bun test suites
└── frontend/       # Next.js dashboard, public status pages, landing page

packages/
├── db/             # Mongoose models (db/client) and shared constants (db/constants)
├── ui/, eslint-config/, typescript-config/
```

---

## ⚙️ Local Development

Prerequisites: **Bun**, **MongoDB** (local or Atlas), a **Clerk** app, and optionally a **Resend** key and a Google **PageSpeed Insights** key.

```bash
bun install

cp apps/api/.env.example apps/api/.env              # MONGODB_URI, CLERK_ISSUER, ...
cp apps/frontend/.env.example apps/frontend/.env.local  # API URL + Clerk keys

bun run dev
```

- API: **http://localhost:8080** (health check at `/health`)
- Frontend: **http://localhost:3000**

`CLERK_ISSUER` is required: the API only trusts tokens from the issuers listed there.

### Checks

```bash
bun run check-types           # type-check every workspace
bun run --cwd apps/api test   # API test suite
bun run --cwd apps/frontend lint
```

CI runs the same steps on every push and pull request.

---

## 🚢 Deployment notes

- **Background jobs** run inside the API by default. To scale separately, run `bun run --cwd apps/api worker` and set `RUN_SCHEDULERS=false` on API instances. Each job takes a Mongo lease, so running several instances is safe.
- Set `FRONTEND_URL` (CORS), `TRUST_PROXY=1` behind a load balancer, and `EMAIL_NOTIFICATIONS_ENABLED=true` with a verified `EMAIL_FROM` to send email.
- Raw check results expire after 90 days and notifications after 30 (TTL indexes).

See `apps/api/.env.example` for every setting.

---

**Monitor. Analyze. Stay online.**
