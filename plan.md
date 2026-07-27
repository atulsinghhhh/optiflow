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
- Upload: presigned direct-to-MinIO upload, chunked/resumable (`tus`), real progress UI (no more mock `setInterval`).
- Folder management: create/rename/move/delete — fully wired, including UI (fixing OptiFlow's dead buttons).
- File versioning, download, preview (images + PDF).
- Image pipeline: thumbnailing via `asynq` job with retry/backoff/DLQ.
- Video pipeline: ffmpeg transcode to HLS (360p/720p/1080p) + poster frame, `hls.js` playback.
- Sharing: public token links + directed user shares, expiry, optional password, download-count limits.
- Notifications: polling first, upgrade to WebSocket by end of v1.
- Storage quota: actually enforced (not just displayed).

**Architecture / DevOps**
- Services: `auth-svc`, `api-svc`, `upload-svc`, `image-worker`, `video-worker`, `notify-svc`.
- Docker Compose for local dev; one Dockerfile per service.
- Basic Kubernetes manifests (or docker-compose for staging if k8s isn't ready yet).
- CI: lint, test, build, image push on merge to `main`.
- Prometheus + Grafana for queue depth, job duration, error rate.
- PgBouncer in front of Postgres from day one.
- CDN in front of MinIO for file/video bytes (biggest single scalability win — do this early, not later).

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