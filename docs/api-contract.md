# UptimeWatch API contract (v2)

Single source of truth for the redesign. All routes are under `/api/v1` and
require a Clerk bearer token unless listed under **Public**. Errors are JSON:
`{ message }` (or `{ message, issues }` for validation errors). Dates are ISO strings.

## Monitors

### Types

`type`: `"http" | "tcp" | "dns" | "heartbeat"`

| Field | Types | Notes |
|---|---|---|
| `name` | all | ≤ 100 chars |
| `url` | http | http(s) URL, SSRF-checked |
| `method` | http | `GET HEAD POST PUT PATCH DELETE` |
| `headers` | http | `{ name, value }[]`, ≤ 10; name matches `^[A-Za-z0-9-]{1,64}$`; value ≤ 1000; `Host` and `Content-Length` rejected |
| `body` | http | string ≤ 10 000; only sent for POST/PUT/PATCH |
| `expectedStatus` | http | e.g. `"200-299,301"` |
| `keyword` | http | ≤ 200 |
| `keywordMode` | http | `"contains" \| "absent"` (default `contains`) |
| `followRedirects` | http | bool |
| `degradedThresholdMs` | http, tcp | `null` or 100–30 000; an UP check slower than this marks the monitor *degraded* |
| `host` | tcp, dns | hostname or IP, ≤ 253; tcp hosts are SSRF-checked at connect time |
| `port` | tcp | 1–65 535 |
| `dnsRecordType` | dns | `A AAAA CNAME MX TXT NS` |
| `dnsExpected` | dns | ≤ 200; `""` = any answer is UP, else some record must contain it (case-insensitive) |
| `intervalSeconds` | all | one of `60 120 300 600 900 1800 3600 21600 43200 86400` |
| `timeoutMs` | http, tcp, dns | 1 000–30 000 |
| `failureThreshold` | http, tcp, dns | 1–10 |
| `graceSeconds` | heartbeat | 0–86 400 |
| `tags` | all | ≤ 10 strings; each trimmed, lower-cased, 1–24 chars of `[a-z0-9 _-]` |
| `alertChannelIds` | all | channel ids owned by the user; `[]` = all enabled channels |
| `reminderMinutes` | all | `0 15 30 60 240 1440`; while down, re-alert every N minutes (0 = off) |
| `paused` | all | bool |

Monitor responses additionally carry: `id, isDown, isDegraded, consecutiveFailures,
lastCheckedAt, lastStatusCode, lastLatency, lastErrorType, lastErrorMessage,
sslExpiresAt, sslIssuer, heartbeatToken, lastHeartbeatAt, maintenanceUntil,
createdAt`. List responses add `websiteTicks` (last 30 min, newest first),
`uptime24h, avgLatency24h, checks24h`, and `sparkline: number[]` (24 hourly
average latencies, oldest first, `0` for hours with no data).

`errorType` gains `"DNS_MISMATCH"` (dns answer didn't contain `dnsExpected`).

### Endpoints

- `GET /websites`, `GET /website/:id`, `POST /website`, `PATCH /website/:id`, `DELETE /website/:id` — as before, with the new fields.
- `POST /website/:id/check` → `{ status, latency, statusCode, errorType, errorMessage, checkedAt }`. Runs a check now and records it like a scheduled one. 429 if the same monitor was manually checked < 10 s ago. Heartbeats: 400.
- `POST /websites/bulk` body `{ ids: string[] (1–100), action: "pause"|"resume"|"delete"|"addTag"|"removeTag", tag?: string }` → `{ updated: number }`. Only the user's monitors are touched.
- `GET /website/:id/checks?limit=50&before=<iso>&status=UP|DOWN` → `{ checks: Tick[], nextBefore: string | null }` (newest first, limit ≤ 200).
- `GET /website/:id/calendar` → `{ days: { date: "YYYY-MM-DD", uptime: number | null, checks: number, downChecks: number }[] }` — last 90 days, oldest first.
- `GET /website/:id/export.csv?range=24h|7d|30d` → `text/csv` with `time,status,status_code,latency_ms,error_type,error_message`.
- `GET /website/:id/analytics?range=` and `GET /website/:id/incidents` — unchanged (incidents now use the `IncidentDetail` shape).

## Overview

`GET /overview` →

```ts
{
  counts: { total, up, down, degraded, paused, maintenance, pending },
  uptime24h: number | null, uptime7d: number | null,
  avgLatency24h: number | null,
  openIncidents: number,
  latencySeries: { t: number /* hour start, ms */, avg: number | null }[], // 24 hourly points across HTTP/TCP monitors
  recentIncidents: IncidentDetail[], // newest 8
  sslExpiring: { id, name, url, sslExpiresAt, daysLeft }[] // ≤ 30 days, soonest first
}
```

## Incidents

```ts
type IncidentUpdateStatus = "investigating" | "identified" | "monitoring" | "resolved";
interface IncidentDetail {
  id: string; websiteId: string; monitorName: string; monitorUrl: string;
  startedAt: string; resolvedAt: string | null; durationMs: number | null; ongoing: boolean;
  lastStatusCode: number | null; errorType: string | null; errorMessage: string | null;
  acknowledgedAt: string | null;
  updates: { id: string; at: string; message: string; status: IncidentUpdateStatus; public: boolean }[];
}
```

- `GET /incidents?status=open|acknowledged|resolved|all&websiteId=&limit=50&before=<iso>` → `{ incidents: IncidentDetail[], nextBefore }`. `open` = ongoing and not acknowledged; `acknowledged` = ongoing and acknowledged.
- `GET /incidents/:id` → `IncidentDetail`
- `POST /incidents/:id/acknowledge` → `IncidentDetail` (idempotent)
- `POST /incidents/:id/updates` body `{ message (1–2000), status, public: boolean }` → `IncidentDetail`
- `GET /incidents/export.csv` → `text/csv` of all the user's incidents.

Recording a recovery appends an automatic `resolved` update (`public: false`).

## Alert channels

`type`: `"email" | "slack" | "discord" | "webhook" | "telegram" | "teams" | "googlechat" | "ntfy"`

| type | `target` | extra |
|---|---|---|
| telegram | bot token `^\d+:[A-Za-z0-9_-]{30,}$` | `chatId` (required, `^-?\d+$` or `^@[A-Za-z0-9_]{5,}$`) |
| teams | `https://*.webhook.office.com/…` or `https://*.logic.azure.com/…` | |
| googlechat | `https://chat.googleapis.com/v1/spaces/…` | |
| ntfy | any https URL (topic URL), SSRF-checked | |

Responses add `chatId?: string`. Telegram target is returned masked (`123456:…abcd`).

Notifications are routed per monitor: when the monitor has `alertChannelIds`, only those (enabled) channels receive its alerts. New notification kind `REMINDER`.

## Status pages

Adds `logoUrl` (`""` or https URL ≤ 500), `accentColor` (`#rrggbb`, default `#ea580c`), `announcement` (≤ 500), `showIncidentHistory` (default `true`).

## Public

- `GET /public/status-pages/:slug` → previous shape plus `logoUrl, accentColor, announcement`, and each incident gains `title` and `updates` (public ones only: `{ at, message, status }`). When `showIncidentHistory` is false, only ongoing incidents are listed.
- `GET /public/status-pages/:slug/badge.svg`, `GET|POST /public/heartbeat/:token` — unchanged.
