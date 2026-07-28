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
- Auth: signup/login, JWT access+refresh, GitHub OAuth, password reset. ⚠️ *Signup/login/refresh plus a dev-mode password reset flow are built. GitHub OAuth is explicitly demoted out of v1 — see Implementation status.*
- Upload: presigned direct-to-MinIO upload, chunked/resumable (`tus`), real progress UI (no more mock `setInterval`). ✅ *Uploads now go through a tus (resumable) endpoint in `upload-svc` end-to-end — see Implementation status.*
- Folder management: create/rename/move/delete — fully wired, including UI (fixing OptiFlow's dead buttons). ✅ *Done — the frontend's dead rename/move/delete dropdown items are now wired to real `api-svc` calls.*
- File versioning, download, preview (images + PDF). ✅ *Version history (list + restore) and "upload new version" are wired — see Implementation status. Preview is still thumbnail-only, no dedicated PDF preview.*
- Image pipeline: thumbnailing via `asynq` job with retry/backoff/DLQ. ✅ Already implemented (`image-worker`).
- Video pipeline: ffmpeg transcode to HLS (360p/720p/1080p) + poster frame, `hls.js` playback. ✅ *Transcode pipeline (`video-worker`) plus `hls.js` playback in the frontend, backed by an authenticated proxy in `upload-svc`.*
- Sharing: public token links, expiry, optional password, download-count limits. ✅ *Built. Directed user-to-user shares (as opposed to public token links) are out of scope; the "Shared with me" concept was replaced with "My Share Links" (outgoing links you created), which is what the backend actually supports.*
- Notifications: polling first, upgrade to WebSocket by end of v1. ✅ *Shipped straight to WebSocket (`notify-svc`'s `/ws`), now with Redis pub/sub fan-out so it's no longer pinned to a single instance — see Implementation status.*
- Storage quota: actually enforced (not just displayed). ✅ *Every user gets a 5 GiB quota (`User.StorageQuotaBytes`), enforced in `upload-svc` before a presigned/tus upload is ever allowed to start.*

**Architecture / DevOps**
- Services: `auth-svc`, `api-svc`, `upload-svc`, `image-worker`, `video-worker`, `notify-svc`. ✅ *All six containerized — see Implementation status.*
- Docker Compose for local dev; one Dockerfile per service. ✅ *`deploy/compose/docker-compose.yaml` now runs all six services alongside Postgres/Redis/MinIO; `deploy/docker/*.Dockerfile` exists for every service.*
- Basic Kubernetes manifests (or docker-compose for staging if k8s isn't ready yet).
- CI: lint, test, build, image push on merge to `main`.
- Prometheus + Grafana for queue depth, job duration, error rate.
- PgBouncer in front of Postgres from day one.
- CDN in front of MinIO for file/video bytes (biggest single scalability win — do this early, not later).

---

#### Implementation status (as of 2026-07-29)

The frontend was carried over from the pre-rewrite Prisma-based app and, until now, was only wired to `auth-svc` (signup/login). Every other dashboard page called dead `/api/*` Next.js routes with no backend behind them. Three passes across 2026-07-28–29 took v1 from that state to fully wired end-to-end: first the core CRUD wiring (folders/files/uploads/notifications), then sharing/profile/analytics/HLS, then the remaining v1 checklist items below (password reset, quota, versioning, tus, notify-svc fan-out, containerization). **v1 is now complete** — every feature and architecture bullet above is either done or has an explicit, documented reason it's out of scope (GitHub OAuth, Safari HLS). What's genuinely done vs. still open:

**Done (first pass — core CRUD wiring):**
- Shared API client layer (`frontend/lib/api/`) with per-service axios instances, JWT attach + silent refresh-and-retry on 401, typed calls matching `api-svc`/`upload-svc`/`notify-svc` exactly.
- Folders and files: full CRUD against `api-svc`, including the previously dead-in-the-UI folder rename/move/delete actions.
- Uploads: real presigned-PUT flow (`upload-svc` `/uploads/presign` → direct PUT to MinIO with live progress → `/uploads/{id}/complete`), replacing the fully-simulated `setInterval` upload UI.
- Downloads/thumbnails: `GET /uploads/{id}/download-url` in `upload-svc`, so file downloads and image thumbnails work.
- CORS: fixed on `api-svc`/`upload-svc` to mirror the existing `auth-svc`/`notify-svc` pattern.
- Notifications: real `GET /notifications` / `PATCH /notifications/{id}/read`, plus a live WebSocket connection to `notify-svc`'s `/ws` (reconnect-with-fresh-token on access-token refresh).
- Design: unified the app on one Stripe-inspired light theme (token system in `app/globals.css`).
- Removed dead code: the fully-simulated `FileUpload` component, an orphaned `hero-dithering-card.tsx`, and leftover Prisma-era packages.

**Done (second pass — sharing, profile, analytics, HLS):**
- **Sharing**: new `Share{id, file_id, user_id, token, password_hash, expires_at, max_downloads, download_count}` model (`internal/models/share.go`), migrated by both `api-svc` and `upload-svc`. `api-svc` owns CRUD (`POST/GET /files/{id}/shares`, `GET/DELETE /shares`, public `GET /shares/{token}` for metadata); `upload-svc` owns the actual download (`POST /shares/{token}/download-url`, public, password-checked, increments `download_count`, respects `expires_at`/`max_downloads`). Frontend: a share dialog on each file (expiry/password/max-downloads + copyable link + revoke), a functional public `/share/[token]` page (password prompt when required, real download), and the old dead "Shared with me" nav page replaced with "My Share Links" (what the backend actually supports — outgoing public links, not directed user-to-user shares).
- **Profile editing**: `auth-svc` gained `GET/PATCH /me` behind the existing JWT middleware. This also fixed a latent bug — `auth-svc`'s `/login` never returned the user's name, so `session.user.name` was always empty ("Unnamed User" everywhere); `lib/auth.ts` now fetches `/me` right after login and threads the name through NextAuth's `jwt`/`session` callbacks, with a `session.update({name})` path so edits from the profile page propagate without a re-login.
- **Analytics**: new `GET /files/stats` on `api-svc`, aggregating every file the user owns across the whole folder tree (previously `GET /files/` only listed one folder level, so the dashboard was explicitly scoped to "root folder" numbers). Dashboard and profile pages now show real account-wide totals.
- **HLS video preview**: resolved the open design question below by choosing neither presigning every segment nor a public-read bucket policy — `upload-svc` exposes an authenticated proxy (`GET /uploads/{id}/hls/*`) that streams the master playlist, variant playlists, and `.ts` segments straight from MinIO, all under the same JWT auth as everything else. `hls.js` (added as a dependency) points at the master playlist with `xhrSetup` attaching the bearer token to every request it makes (master, variants, segments alike), since they're all relative fetches against the same authenticated base URL. A "Play" action on ready video files opens an in-app player. Native Safari HLS is explicitly *not* supported this way (no way to attach custom headers to its internal segment fetches) and shows an honest error rather than faking playback.
- **File delete MinIO cleanup**: `api-svc` now holds its own MinIO client and, on `DELETE /files/{id}`, best-effort removes the original object, thumbnail/poster, and (for videos) every object under `hls/{id}/` — logged loudly on failure, but never blocks the metadata delete.

**Done (third pass — closing out the remaining v1 checklist):**
- **Password reset**: `auth-svc` gained `PasswordResetToken{user_id, token_hash, expires_at, used}` plus `POST /password-reset/request` / `POST /password-reset/confirm`. No email/SMTP provider exists anywhere in the stack (see Open Decisions), so `/request` returns the raw reset token directly in its JSON response instead of emailing it — explicitly flagged dev-mode, with a TODO to switch to a generic response once a provider is chosen. Frontend: `/forgot-password` and `/reset-password` pages, linked from sign-in.
- **GitHub OAuth demoted out of v1**: needs a real GitHub OAuth App (client ID/secret) that only the repo owner can register; no credentials were provided this pass, so it stays disabled (as it already was) rather than being half-built against placeholder credentials. Revisit when credentials are available.
- **Storage quota enforcement**: `User.StorageQuotaBytes` (default 5 GiB) plus `upload-svc.checkQuota`, called before both the presigned-PUT and tus upload paths ever start — sums the user's existing files (including old file versions, which still occupy real storage) and rejects with 413 if the incoming upload would exceed quota. Trusts the client's declared size (good enough to catch honest overages at v1; not adversarial-proof — closing that gap needs re-checking and cleaning up storage in `complete()`/tus completion, deferred). Dashboard and profile now show a real quota bar instead of "not enforced yet."
- **File version history**: `File` gained `IsCurrent` (exactly one true row per lineage) alongside its existing `Version`/`ParentID`. `api-svc`: `GET /files/{id}/versions`, `POST /files/{id}/versions/{versionId}/restore` (flips `is_current`, never duplicates or deletes rows). `upload-svc`: `POST /uploads/{id}/versions/presign` uploads a replacement that immediately supersedes the current version. File and folder deletion were both updated to walk and remove the *entire* version lineage (all superseded rows + their MinIO objects + their shares) instead of just the current row — previously old versions/shares/objects would have been orphaned. Frontend: a version history dialog (upload new version, restore old ones) on every file.
- **`notify-svc` multi-instance readiness**: the in-process `map[userID][]*Conn` hub is now backed by Redis pub/sub — `publish` fans a notification out to every replica via one shared channel, and each replica's `deliverLocal` writes to whichever local WebSocket connections it happens to hold. Works identically for a single instance (the publish comes right back to the same subscriber) and for many. Bonus fix found along the way: `video-worker` never actually constructed a `notify.Client` in `main.go` (unlike `image-worker`, which did), so "video ready"/"processing failed" notifications were silently never sent for videos — fixed to match `image-worker`'s pattern.
- **Per-service Dockerfiles + full docker-compose**: `deploy/docker/{auth,api,upload,image-worker,notify}-svc.Dockerfile` added (`video-worker.Dockerfile` already existed); `deploy/compose/docker-compose.yaml` now brings up all six Go services alongside Postgres/Redis/MinIO, wired with internal service-name networking and env vars matching each service's own `.env`. The frontend is deliberately *not* containerized in this compose file — its `NEXT_PUBLIC_*_SVC_URL` values are baked in at build time and must be browser-reachable, while NextAuth's server-side calls reuse those same public URLs, so folding it into this network would need a real split between browser-facing and server-to-server URLs. It still runs via `npm run dev` against these services' host-mapped ports.
- **Chunked/resumable (`tus`) uploads**: `upload-svc` mounts a tus 1.0 endpoint (`github.com/tus/tusd/v2`, `POST/PATCH/HEAD /uploads/tus/*`) backed by local-disk staging (tusd's filestore) rather than direct-to-MinIO multipart — chosen because it reuses 100% of the existing MinIO/queue/notification code path once an upload finishes, at the cost of pinning in-progress uploads to whichever `upload-svc` replica received them (same single-instance caveat as `notify-svc` before its Redis fix). On completion, the assembled file is pushed into MinIO and processed exactly like any other upload (same `File` row shape, thumbnail/transcode enqueue, quota check at creation time via a pre-upload hook that reads the authenticated user from request context). The frontend's main upload dialog now uses `tus-js-client` end-to-end, verified live (create → chunk → finish → thumbnail pipeline → shows up in the file list). "Upload new version" still uses the older single presigned-PUT path, not migrated to tus this pass — smaller files, lower priority.

**Still open (v2+ concerns, not v1 blockers):**
- **Storage quota isn't adversarial-proof** — it trusts the client's declared upload size at creation time rather than re-verifying actual bytes received.
- **Safari native HLS** isn't supported by the in-app player — would need either a signed-cookie/query-token scheme or a public-read bucket policy, neither of which is free. Documented, not silently broken (an honest error shows instead of fake playback).
- **Frontend containerization** — deliberately deferred (see above); needs a real design for browser-facing vs. server-to-server service URLs before it's worth doing.
- Kubernetes manifests, CI pipeline, Prometheus/Grafana, PgBouncer, CDN — all still v1 architecture-bullet items with no work started; tracked here rather than re-litigated per pass.

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
- Email provider for transactional mail (password reset, share notifications, etc.) — nothing is wired up yet, so `POST /password-reset/request` returns the raw reset token in its response body as an interim dev-mode measure instead. Needs a real choice (SES, Postmark, Resend, etc.) before that response shape can change to a generic "check your email."
- GitHub OAuth App registration (client ID/secret) for GitHub sign-in — needs the repo owner to create one; nothing to build until credentials exist.