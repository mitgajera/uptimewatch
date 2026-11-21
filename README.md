# UptimeWatch

UptimeWatch is a full-stack uptime and API monitoring platform inspired by services like Datadog and UptimeRobot. Monitor websites and APIs, track availability and response times, analyze historical performance, and receive email alerts whenever a service goes down or recovers.

## Features

- **Uptime Monitoring**
  - Automatically checks websites and APIs every minute.
  - Supports both websites and REST API endpoints.

- **Performance Analytics**
  - Track uptime percentage.
  - Monitor response times.
  - View complete check history and status trends.

- **Instant Email Notifications**
  - Receive alerts when a monitored service becomes unavailable.
  - Get notified again once the service has recovered.

- **PageSpeed Insights**
  - Generate on-demand performance reports for monitored websites.

- **Authentication**
  - Secure email authentication powered by Clerk.

- **Modern Dashboard**
  - Responsive interface built with Next.js and Tailwind CSS.
  - Supports both light and dark themes.

---

## How It Works

1. Sign in using Clerk authentication.
2. Add a website or API endpoint to monitor.
3. The monitoring service checks each endpoint every minute using scheduled cron jobs.
4. Each check records:
   - Availability status
   - HTTP response time
   - Timestamp
5. View uptime statistics, response time history, and monitoring logs from the dashboard.
6. Receive automatic email notifications whenever a service goes down or comes back online.

---

## Tech Stack

| Layer | Technologies |
|--------|--------------|
| Frontend | Next.js, React, Tailwind CSS, TypeScript |
| Backend | Node.js, Express, Bun |
| Database | MongoDB, Mongoose |
| Authentication | Clerk |
| Monitoring | Axios, node-cron |
| Email Service | Resend |
| Monorepo | Turborepo |

---

## Project Structure

```text
apps/
├── api/                  # Express API, monitoring service, cron jobs, email notifications
└── frontend/             # Next.js dashboard

packages/
├── db/                   # Database models and connection
├── ui/                   # Shared UI components
├── eslint-config/
└── typescript-config/
```

---

## Getting Started

### Prerequisites

Before running the project, make sure you have:

- Bun
- MongoDB (local instance or MongoDB Atlas)
- Clerk application
- Resend API key

### Installation

```bash
git clone <repository-url>

cd uptimewatch

bun install
```

### Environment Variables

Copy the example environment files and configure them.

#### API

```bash
cp apps/api/.env.example apps/api/.env
```

Configure:

```env
MONGODB_URI=
CLERK_ISSUER=
RESEND_API_KEY=
```

#### Database Package

```bash
cp packages/db/.env.example packages/db/.env
```

Configure:

```env
MONGODB_URI=
```

#### Frontend

Create a `.env.local` file inside `apps/frontend` and configure:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_API_BACKEND_URL=http://localhost:8080
```

---

## Running the Project

Start both the frontend and backend.

```bash
bun run dev
```

### Default Ports

| Service | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |

---

## Monitoring Workflow

```
User
  │
  ▼
Add Website/API
  │
  ▼
Cron Job (Every Minute)
  │
  ▼
HTTP Request (Axios)
  │
  ├── Success
  │      └── Save latency & status
  │
  └── Failure
         ├── Save downtime
         └── Send email notification
```

---

## Future Improvements

- Multiple monitoring regions
- Slack and Discord notifications
- SMS alerts
- Status pages
- Custom monitoring intervals
- SSL certificate monitoring
- Webhook integrations
- Team workspaces
- Public status dashboards

---
