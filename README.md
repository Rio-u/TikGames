# TikGames

Interactive overlay games for TikTok Live streamers. Viewers trigger games (Trivia, Musical
Chairs, Spin Wheel, Guess the Number, Reaction Race, Would You Rather) by commenting in the
streamer's live chat; the streamer runs the result as a transparent Browser Source in OBS.

> **Status:** Phase 1 — monorepo scaffold + database schema. No business logic yet.

## Architecture

```
                         ┌─────────────────────┐
                         │   Dashboard (React)  │  streamer UI + /admin (role-gated)
                         │  apps/dashboard       │  Tailwind, RTL+i18n, Framer Motion
                         └──────────┬───────────┘
                                    │ REST (JWT) + Socket.io (live monitoring)
                                    ▼
┌───────────────────┐     ┌─────────────────────┐      ┌──────────────────────┐
│  Overlay (React)   │◄────┤    API (apps/api)    │◄─────┤ tiktok-connector-svc  │
│  apps/overlay       │ WS │ Express/Fastify+Socket│ WS  │ apps/tiktok-connector  │
│  transparent, token │    │ .io, game state       │internal, │ tiktok-live-connector │
│  -scoped, read-only │    │ machines, REST API    │auth'd    │ wraps LiveSourceConnector │
└───────────────────┘     └──────────┬───────────┘  secret  │ interface (TikTok now, │
                                      │                       │ Kick later)            │
                                      ▼                       └──────────────────────┘
                            ┌───────────────────┐                      │
                            │   PostgreSQL        │                      │ health pings /
                            │  (Supabase; Prisma, │                      │ connector:alert on
                            │   packages/database)│                      │ failure → Alert row
                            └───────────────────┘                      │  → surfaced in /admin
```

Flow: a streamer clicks "Go Live" in the dashboard → the API creates a `LiveSession` and tells
`tiktok-connector` to start watching `channelUsername` → the connector opens a
`WebcastPushConnection` (via `tiktok-live-connector`), normalizes `comment` / `gift` / `like` /
`follow` events, and streams them to the API over an authenticated internal Socket.io channel →
the API feeds events into the active game's state machine and broadcasts state deltas to the
Overlay (public, token-scoped, read-only room) and the Dashboard (live monitoring/leaderboard).

## ⚠️ Unofficial TikTok Live dependency — read this before touching `tiktok-connector`

TikTok has **no official API** for reading live-room comments in real time. This project relies
on [`tiktok-live-connector`](https://www.npmjs.com/package/tiktok-live-connector), an
open-source (MIT) library that speaks TikTok's undocumented internal WebCast protocol, the same
approach used industry-wide (its Python sibling is `TikTokLive`). It requires a "signing" service
to mint `msToken`/`X-Bogus` tokens on every connect — the default is
[Euler Stream](https://www.eulerstream.com/) (free tier available, paid tiers for volume).

Consequences that shape the design:
- **This can break without notice.** TikTok changing an internal protocol detail, or the signing
  provider falling behind, can silently kill every live connection.
- `tiktok-connector` therefore **fails loudly, never silently**: connection errors, unexpected
  disconnects, or repeated signing failures immediately emit a `connector:alert` event to the
  API, which persists an `Alert` row (see schema) and must surface it in the admin panel — not
  just a log line nobody reads.
- A health-check / heartbeat mechanism (`LiveSession.lastHeartbeatAt`) is required so the API can
  detect a connector that's silently stopped receiving events, not just one that errored.
- The live-source integration sits behind a `LiveSourceConnector` interface
  (`packages/shared-types`, landing next phase) so a second implementation — e.g. a
  `kick-connector` against Kick's real, documented events API — can be added later without
  changing `apps/api`.

Do not treat this connector as a reliable, guaranteed-uptime integration. Treat every design
decision around it (retries, alerting, graceful degradation) as load-bearing.

## Monorepo layout

```
tikgames/
  apps/
    api/                  Main backend: REST + Socket.io, auth, subscriptions, game engines
    tiktok-connector/     Standalone service, tiktok-live-connector wrapper, health checks
    dashboard/            Streamer dashboard + /admin (React + TS + Tailwind + Framer Motion)
    overlay/               OBS Browser Source page (React, transparent bg, WS-driven)
  packages/
    database/              Prisma schema + generated client (shared by apps/api)
    shared-types/           LiveSourceConnector contract, WS event DTOs, game state types
    config/                 Shared tsconfig base
  setup.bat                  One-click: installs Node/pnpm, sets up the DB + accounts, runs everything
  start.bat                  Runs the whole stack: api + tiktok-connector + dashboard + overlay
```

## Local setup

Database is **PostgreSQL on [Supabase](https://supabase.com)** — one cloud database shared by
local development and production. Nothing installs a database on your machine; you only need a
`DATABASE_URL` pointing at your Supabase project (see [DEPLOY.md](DEPLOY.md) §1 for creating one
and getting the Session-pooler connection string).

```bash
pnpm install
cp packages/database/.env.example packages/database/.env   # then paste your Supabase URL in
cp apps/api/.env.example apps/api/.env                      # ...and here too
pnpm db:push                         # prisma db push — creates every table on Supabase
cd apps/api && node seed.mjs         # accounts (d7 / nfnf) + game backgrounds
start.bat                            # day to day: starts every app, each in its own window
```

Or just double-click **`setup.bat`** — it installs Node/pnpm if missing, installs packages,
checks `DATABASE_URL` is set, pushes the schema, seeds the accounts and backgrounds, and starts
all four apps. (It refuses to continue with the placeholder `DATABASE_URL` still in `.env` and
tells you exactly where to paste your Supabase string.)

`start.bat` opens a console window per app (`api`, `tiktok-connector`, `dashboard`, `overlay`)
running that app's `dev` script. Close a window to stop that service; re-running `start.bat` is
safe.

Because the database lives on Supabase, `pnpm db:studio` and `pnpm db:push` work from anywhere
with your `DATABASE_URL` set — no local server to bring up first.

## Environment variables (later phases)

These aren't required yet, but the code will read them once auth and the connector are built —
placeholders now so nothing is a surprise later:

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | `packages/database`, `apps/api` | PostgreSQL (Supabase) connection string — use the Session-pooler URI |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | `apps/api` | Auth token signing |
| `EULER_STREAM_API_KEY` | `apps/tiktok-connector` | TikTok signing provider (free tier works to start) |
| `TIKTOK_OAUTH_CLIENT_KEY`, `TIKTOK_OAUTH_CLIENT_SECRET` | `apps/api` | Optional "Login with TikTok" |
| `CONNECTOR_INTERNAL_SECRET` | `apps/api`, `apps/tiktok-connector` | Auths the internal WS channel between the two services |

## Subscriptions & payments

`Subscription.status` moves `TRIAL → ACTIVE/EXPIRED/SUSPENDED`. Every signup gets an automatic
3-day full-access trial (no admin action needed). Converting to a paid subscription is a manual
admin action for now (`Payment.provider = MANUAL`); the schema already has `PAYMOB` and
`PAYTABS` as provider options so a real gateway can be wired in later without restructuring
the schema. `Payment.amount` is stored as an `Int` in minor currency units (cents/qirsh) to avoid
floating-point money bugs.
