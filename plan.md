# StreamVault — Project Plan
### (working name — file & video sharing platform, Go backend, Next.js frontend)

## 1. Goal

Rebuild the existing Next.js/Prisma file-manager ("OptiFlow") into a **Go-based, multi-service backend** paired with a **Next.js frontend**, supporting file *and video* upload, storage, sharing, and streaming preview — with a real DevOps pipeline (containerized services, CI/CD, orchestration, observability) and a scalability path from single-VM to multi-region.

This is a rewrite, not a port: backend services are split by responsibility from day one so each can scale independently. Frontend stays Next.js (App Router) — it's a client of the Go backend, not a monolith with it.

---

## 2. Tech Stack

### Frontend
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | SSR for dashboard, good DX, keeps prior investment |
| Data fetching | React Query / SWR against Go REST API | caching, revalidation, optimistic updates |
| Video preview | `hls.js` | plays the HLS renditions produced by `video-worker` |
| Auth | NextAuth *only* for session cookie glue → exchanges for JWT issued by `auth-svc` | keep session handling familiar, but token authority lives in Go |
| Realtime | native WebSocket client / `EventSource` for SSE | connects to `notify-svc` |
| Uploads | direct-to-MinIO via presigned URL, `tus-js-client` for resumable/chunked | large video files never touch the app server |

### Backend
| Layer | Choice | Why |
|---|---|---|
| Language | Go 1.22+ | concurrency for workers, single static binaries, easy containerization |
| HTTP framework | `chi` (or `echo`) | lightweight, stdlib-compatible, good middleware ecosystem |
| DB access | `GORM` | fast iteration, struct-based models double as migration source |
| Migrations | `GORM AutoMigrate` (+ hand-written SQL in `/backend/migrations` for drops/renames/backfills) | additive changes ship with the model, no separate codegen step |
| DB | PostgreSQL 16 (+ PgBouncer from v1) | connection pooling matters early with many service instances |
| Object storage | MinIO (S3-compatible), swappable for AWS S3 | dev/prod parity |
| Queue | Redis + **asynq** | retries, backoff, scheduled jobs, dashboard (`asynqmon`) |
| Pub/sub (v2+) | NATS | fan-out events (search index, webhooks, analytics) without coupling workers together |
| Auth | JWT (access + refresh) via `golang-jwt`, bcrypt | stateless, service-friendly |
| Video processing | `ffmpeg` via `os/exec` | transcode to HLS renditions |
| Search (v2+) | Meilisearch or `bleve` | full-text/metadata search |
| Realtime | `nhooyr.io/websocket` or SSE | replace 30s polling |
| Logging | `zerolog`, structured JSON | ships cleanly to Loki |
| Metrics | `prometheus/client_golang` | `/metrics` on every service |
| Tracing | OpenTelemetry SDK → Jaeger/Tempo | trace a request across services |
| Resilience | `sony/gobreaker` (circuit breakers), separate pools per dependency (bulkheads) | v2+ hardening |

---

## 3. Architecture Overview

```
        ┌────────────┐
        │  Next.js   │  (SSR dashboard, session cookie, React Query)
        └─────┬──────┘
              │
        ┌─────▼──────┐
        │ Nginx/Traefik│ (TLS, gateway rate limiting)
        └─────┬──────┘
   ┌───────────┼───────────────┬───────────────┐
┌──▼───┐  ┌────▼─────┐   ┌─────▼──────┐  ┌──────▼──────┐
│auth- │  │  api-svc │   │upload-svc  │  │ notify-svc  │
│svc   │  │(metadata,│   │(presigned  │  │ (WS/SSE)    │
│(JWT) │  │ folders, │   │ URLs,      │  │             │
│      │  │ shares)  │   │ chunked)   │  │             │
└──┬───┘  └────┬─────┘   └─────┬──────┘  └──────┬──────┘
   │           │                │                 │
   │     ┌─────▼─────┐   ┌──────▼──────┐          │
   │     │ Postgres  │   │   MinIO     │◀─────────┘
   │     │ (+PgBouncer)│  │ (+ CDN v2+)│
   │     └───────────┘   └──────┬──────┘
   │                             │
   └────────────┬────────────────┘
          ┌──────▼──────┐
          │ Redis(asynq)│──── NATS (v2+, event fan-out)
          └──────┬──────┘
      ┌───────────┼────────────┐
┌─────▼─────┐┌────▼──────┐┌────▼─────────┐
│image-worker││video-worker││search-indexer│ (v2+)
└───────────┘└───────────┘└──────────────┘
```

---

## 4. Feature & Scalability Roadmap — v1 / v2 / v3

The idea: **v1 proves the core product works end-to-end** (upload → process → share → preview) on a single small cluster. **v2 makes it collaborative and discoverable** and starts hardening for real traffic. **v3 makes it a platform** with public API, resilience, and multi-region readiness. Don't start v2 work before v1 is fully wired — half-wired features are exactly what bit the old codebase.

### 🟢 v1 — Core Product (MVP, single-region, small scale)

**Features**
- Auth: signup/login, JWT access+refresh, GitHub OAuth, password reset.
- Upload: presigned direct-to-MinIO upload, chunked/resumable (`tus`), real progress UI (no more mock `setInterval`). ✅ *Presigned PUT + real progress UI is wired; chunked/resumable (`tus`) is not — see Implementation status below.*
- Folder management: create/rename/move/delete — fully wired, including UI (fixing OptiFlow's dead buttons). ✅ *Done — the frontend's dead rename/move/delete dropdown items are now wired to real `api-svc` calls.*
- File versioning, download, preview (images + PDF). ⚠️ *Download is wired. `File.version` exists but there's no version-history endpoint — no version list/restore UI. Preview is thumbnail-only, no PDF preview.*
- Image pipeline: thumbnailing via `asynq` job with retry/backoff/DLQ. ✅ Already implemented (`image-worker`).
- Video pipeline: ffmpeg transcode to HLS (360p/720p/1080p) + poster frame, `hls.js` playback. ⚠️ *Transcode pipeline is implemented (`video-worker`). `hls.js` playback in the frontend is not — see Implementation status.*
- Sharing: public token links + directed user shares, expiry, optional password, download-count limits. ❌ *Not built — no `Share` model or endpoints exist anywhere in the backend. See Implementation status for the scoping decision needed.*
- Notifications: polling first, upgrade to WebSocket by end of v1. ✅ *Shipped straight to WebSocket (`notify-svc`'s `/ws` already existed) — skipped the polling intermediate step.*
- Storage quota: actually enforced (not just displayed). ❌ *Not built — no quota field on `User`, nothing enforced. Frontend now shows real storage-used numbers instead of a fake quota bar, but there's no limit to enforce against yet.*

**Architecture / DevOps**
- Services: `auth-svc`, `api-svc`, `upload-svc`, `image-worker`, `video-worker`, `notify-svc`.
- Docker Compose for local dev; one Dockerfile per service.
- Basic Kubernetes manifests (or docker-compose for staging if k8s isn't ready yet).
- CI: lint, test, build, image push on merge to `main`.
- Prometheus + Grafana for queue depth, job duration, error rate.
- PgBouncer in front of Postgres from day one.
- CDN in front of MinIO for file/video bytes (biggest single scalability win — do this early, not later).

---

#### Implementation status (as of 2026-07-28)

The frontend was carried over from the pre-rewrite Prisma-based app and, until now, was only wired to `auth-svc` (signup/login). Every other dashboard page called dead `/api/*` Next.js routes with no backend behind them. This pass wired the frontend to the real Go services end-to-end. What's genuinely done vs. still open:

**Done:**
- Shared API client layer (`frontend/lib/api/`) with per-service axios instances, JWT attach + silent refresh-and-retry on 401, typed calls matching `api-svc`/`upload-svc`/`notify-svc` exactly.
- Folders and files: full CRUD against `api-svc`, including the previously dead-in-the-UI folder rename/move/delete actions.
- Uploads: real presigned-PUT flow (`upload-svc` `/uploads/presign` → direct PUT to MinIO with live progress → `/uploads/{id}/complete`), replacing the fully-simulated `setInterval` upload UI.
- Downloads/thumbnails: added `GET /uploads/{id}/download-url` to `upload-svc` (no such endpoint existed before — `storage.PresignedGetURL` was implemented but had zero callers), so file downloads and image thumbnails now work.
- CORS: `api-svc` and `upload-svc` had no CORS middleware at all (unlike `auth-svc`/`notify-svc`) — browser calls would have failed outright. Fixed to mirror the existing pattern.
- Notifications: real `GET /notifications` / `PATCH /notifications/{id}/read`, plus a live WebSocket connection to `notify-svc`'s `/ws` (with reconnect-with-fresh-token on access-token refresh) — replacing 30s polling against a dead endpoint.
- Design: unified the app on one Stripe-inspired light theme (token system in `app/globals.css`) instead of two clashing visual languages (light landing/auth vs. hardcoded dark violet/slate dashboard). The dashboard was also being force-locked into dark mode by a stray `className="dark"` on `<html>`, independent of the token mismatch.
- Removed dead code: the fully-simulated `FileUpload` component, an orphaned `hero-dithering-card.tsx` (and its exclusive `@react-three/fiber`/`three`/`@paper-design/shaders-react` dependencies), and leftover Prisma-era packages (`@prisma/*`, `pg`, `ioredis`, `minio`, `bcryptjs`) with zero references in the current codebase.
- Profile, Shared, and the public `/share/[token]` pages: disconnected from dead `/api/*` calls and replaced with an honest "not yet available" state instead of a silent 404 — per this file's own "no dead code / no unwired features" rule.

**Still open (tracked, not silently punted):**
- **Sharing** has no backend at all — no `Share` model, no endpoints, despite being listed above as v1 and marketed on the landing page. This needs an explicit call: either pull a small `Share{id, file_id, token, expires_at}` model + `POST /shares` / `GET /shares/{token}` into near-term v1 scope, or formally demote it out of the v1 checklist. Not decided here.
- **Profile editing** — `auth-svc` only issues `{id, email}` via JWT claims and has no `GET/PATCH /me`. The frontend now shows real read-only session data instead of a fake editable profile, but there's nothing to edit against yet.
- **Analytics** — no aggregation endpoint on `api-svc`. The dashboard overview now derives real stats from `GET /files/` instead of showing a fake historical chart, but that endpoint only lists one folder level at a time — there's no recursive/account-wide total, so the UI is explicitly scoped to "root folder" numbers. A real account-wide view needs a small aggregation endpoint.
- **Chunked/resumable upload (`tus`)** — not built; uploads are a single presigned PUT, which is fine for typical files but not resilient to a dropped connection on very large ones.
- **File delete doesn't clean up the MinIO object** — already noted in `handlers_file.go`'s code comment; now also flagged here so it's visible without reading Go source.
- **`notify-svc`'s WebSocket hub is single-instance** (in-process `map[userID][]*Conn`, no Redis/NATS fan-out) — fine for a single-instance v1 deploy, but ties directly into the v2 NATS event-fan-out item below once notify-svc needs to run more than one replica.
- **HLS video preview (`hls.js`)** — listed in the stack table above as v1, but not implemented this pass. A single presigned URL for the HLS master `.m3u8` isn't sufficient on its own — every referenced `.ts` segment also needs to be fetchable, which is a real design decision (segment-level presigning vs. a public-read bucket policy) rather than something to improvise in the frontend. Video files currently show status/thumbnail like any other file, no player.
- **`deploy/compose/docker-compose.yaml`** only brings up infra (Postgres/Redis/MinIO) — none of the six Go services are containerized/composed yet; each currently runs via `go run ./cmd/<svc>`. `deploy/docker/video-worker.Dockerfile` exists as a partial start toward per-service Dockerfiles.

---

### 🟡 v2 — Collaboration & Hardening (growing traffic, multi-user teams)

**Features**
- Teams/workspaces: shared drives, role-based permissions (viewer/editor/owner).
- Comments/annotations on files, timestamped comments on video.
- Activity feed per file/folder (views, downloads, comments).
- Full-text/metadata search (Meilisearch or `bleve`), replacing `LIKE` search.
- Smart folders / saved filters.
- Basic AI tagging for images (extendable to video transcripts later).
- Webhooks on job completion (upload processed, transcode done, share expiring).
- Malware/virus scan on upload (ClamAV sidecar) — required once public sharing is real.
- Admin dashboard: queue depth, worker health, storage usage per user, abuse reports.
- Video seek-bar thumbnail sprite sheets.

**Architecture / DevOps**
- Introduce NATS for event fan-out (transcode-complete → search index + webhook + notification, decoupled).
- Read replicas for Postgres; move analytics off live OLTP tables into rollups (or ClickHouse if volume justifies it).
- Redis cache-aside for hot metadata (folder listings, share-token lookups — the most publicly hittable endpoint).
- Separate `asynq` queues/priorities (`video:high`, `video:default`, `image:default`).
- KEDA-based autoscaling for workers, keyed on queue depth.
- Circuit breakers (`gobreaker`) + bulkheads on service-to-service calls.
- Canary/blue-green rollout (Argo Rollouts) for `api-svc` and `upload-svc`.
- Load testing with `k6` against realistic upload+transcode traffic mixes.

---

### 🔴 v3 — Platform & Scale (public API, resilience, multi-region)

**Features**
- Public developer API + API keys, with per-key rate limiting.
- Live streaming ingest (RTMP → HLS), reusing the transcode pipeline.
- Optional watermarking/DRM-lite on shared video links.
- Billing/subscription tiers (ties into storage quota + rate limits + priority queues).
- Batch actions, ZIP download, cross-folder move/copy.

**Architecture / DevOps**
- Multi-region object storage (MinIO/S3 cross-region replication) + geo-DNS routing for uploads.
- Region-aware job placement so transcoding happens near where the file landed.
- gRPC between internal services (replacing REST where latency/throughput matters).
- Full distributed tracing (OpenTelemetry → Jaeger/Tempo) across every service.
- Chaos-testing / game days on worker and queue failure paths.
- SLA-backed on-call runbooks, backup/restore drills for Postgres + object storage.

---

## 5. Non-Functional Targets (apply from v1 onward)

- Video transcode jobs never block API responsiveness (fully async via queue).
- Uploads support multi-GB files via chunked/resumable + presigned URLs — never buffered through the app server.
- Every service exposes `/healthz` and `/metrics`.
- `api-svc` and `upload-svc` are stateless and horizontally scalable behind the LB; workers scale by queue depth, not CPU.
- Every async job type has explicit retry count + backoff + dead-letter handling — no silent-forever-retry, no silent-drop.

## 6. Open Decisions (revisit as you build)

- gRPC vs REST for internal service-to-service calls (lean gRPC once 3+ services talk to each other — targeted for v3, but can pull forward if pain shows up sooner).
- Self-hosted MinIO vs cloud S3 for prod.
- Managed Postgres vs self-hosted for prod.
- NATS vs Kafka for v2 event fan-out (NATS is lighter to operate; Kafka only if you expect very high sustained event volume).
- Whether `notify-svc` supports SSE fallback alongside WebSocket for simpler/older clients.