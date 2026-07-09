# 🌐 UptimeWatch

**UptimeWatch** is a full-stack **uptime & API monitoring platform** (a mini Datadog / UptimeRobot). Add your websites and APIs, and the platform checks them every minute, records response time and status, shows live uptime analytics, and alerts you by email the moment something goes down.

---

## 🚀 Features

- 🔍 **Uptime Monitoring** – Every website/API is checked every minute from the central server.
- 📊 **Real-Time Insights** – Dashboard with uptime %, response time, and check history.
- 🚨 **Email Alerts** – Get notified instantly when a site goes down and again when it recovers.
- ⚡ **PageSpeed Insights** – On-demand performance reports per website.
- 👤 **Auth** – Email-based sign in/up via Clerk.
- 🌓 **Dark/Light UI** – Clean, responsive Next.js + Tailwind interface.

---

## 🎯 How It Works

1. 🔐 **Sign in** with Clerk.
2. ➕ **Add a website/API** URL (free).
3. ⏱️ **The server checks it every minute** (`axios` + `node-cron`), recording status (UP/DOWN) and latency.
4. 📈 **View analytics** — uptime %, latency, and check history on your dashboard.
5. 📬 **Get alerted** by email when a site goes down or recovers.

---

## 🛠️ Tech Stack

| Layer        | Tech                                  |
|--------------|---------------------------------------|
| Frontend     | Next.js, React, Tailwind CSS, TypeScript |
| Backend      | Node.js, Express, Bun                  |
| Database     | MongoDB, Mongoose                      |
| Auth         | Clerk (JWT)                            |
| Monitoring   | Axios, node-cron                       |
| Email        | Resend                                 |
| Monorepo     | Turborepo                             |

---

## 📦 Monorepo Structure

```
apps/
├── api/          # Express backend: REST API + cron-based monitor + email alerts
└── frontend/     # Next.js dashboard (uptime UI, auth, charts)

packages/
├── db/           # Mongoose models + connection
├── ui/           # Shared UI components
├── eslint-config/
└── typescript-config/
```

---

## ⚙️ Local Development

Prerequisites: **Bun**, a **MongoDB** instance (local or Atlas), a **Clerk** app, and a **Resend** API key.

```bash
bun install

# Configure environment
cp apps/api/.env.example apps/api/.env       # set MONGODB_URI, CLERK_ISSUER, RESEND_API_KEY
cp packages/db/.env.example packages/db/.env # set MONGODB_URI
# In apps/frontend, set Clerk keys + NEXT_PUBLIC_API_BACKEND_URL

# Run everything
bun run dev
```

- API runs on **http://localhost:8080**
- Frontend runs on **http://localhost:3000**

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for full details.

---

**Monitor. Analyze. Stay online.**
