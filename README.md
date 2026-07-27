# StreamVault (formerly OptiFlow)

[![Frontend CI](https://github.com/atulsinghhhh/optiflow/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/atulsinghhhh/optiflow/actions/workflows/frontend-ci.yml)
[![Deploy to Production](https://github.com/atulsinghhhh/optiflow/actions/workflows/deploy.yml/badge.svg)](https://github.com/atulsinghhhh/optiflow/actions/workflows/deploy.yml)

StreamVault is a file & video upload, storage, sharing, and streaming-preview platform. It's a from-scratch rewrite of the original OptiFlow (Next.js + Prisma monolith) into a **Go multi-service backend paired with a Next.js frontend**. See [`plan.md`](./plan.md) for the full architecture and v1/v2/v3 roadmap, and [`claude.md`](./claude.md) for engineering conventions.

> **Status:** the Next.js frontend below is the original, fully working OptiFlow app — it has not been switched over to the Go backend yet and still talks to its own Next.js API routes / Prisma / MinIO directly. On the Go backend, `auth-svc` (signup/login/JWT refresh), `api-svc` (folders + file metadata, JWT-protected), and `upload-svc` (presigned direct-to-MinIO upload) are implemented and tested end-to-end against real Postgres + MinIO. `notify-svc`, `image-worker`, `video-worker` are still scaffolds exposing only `/healthz`.

## 📦 Repo Structure

This is a monorepo: Go backend and Next.js frontend live in separate top-level trees.

```text
/backend            # Go services (scaffold stage — see plan.md Phase v1)
  /cmd
    /auth-svc        # :8081
    /api-svc         # :8082
    /upload-svc      # :8083
    /notify-svc      # :8084
    /image-worker
    /video-worker
  /internal          # auth (JWT/bcrypt), storage, queue, db (GORM connection), models (GORM structs), middleware
  /migrations        # hand-written SQL for schema changes AutoMigrate can't express (drops, renames, backfills)
  go.mod

/frontend            # existing Next.js app (App Router) — the working product today
  /app               # pages + API routes
  /components        # Shadcn UI components
  /lib               # Prisma/MinIO/Redis clients, utils
  /prisma            # schema + migrations
  /workers           # Node/Redis background worker (thumbnail generation)
  /scripts           # seed/enqueue/monitor scripts
  /public

/deploy
  /compose           # docker-compose.yaml for the Go backend's local dev stack (Postgres/Redis/MinIO)
  /docker            # per-service Dockerfiles (backend)
  /k8s               # manifests / Helm chart (future)

docker-compose.yaml  # runs the current frontend stack (db, redis, storage, web, nginx)
nginx/               # reverse proxy config for the frontend stack
plan.md              # architecture + roadmap
claude.md            # repo conventions for AI-assisted development
```

## 🚀 Features (current frontend)

- **File Management:** Upload, organize, and manage files in a hierarchical folder structure.
- **Background Processing:** Asynchronous file processing pipeline using Redis and a dedicated worker process.
- **Thumbnail Generation:** Automatic generation of optimized image thumbnails (800x600 JPEG) using Sharp.
- **Chunked Uploads:** Large file uploads via a chunked upload mechanism.
- **Secure Sharing:** Shareable tokens with optional expiration and recipient restrictions.
- **Authentication:** NextAuth.js.
- **Analytics:** Storage usage and file activity tracking.
- **Modern UI:** Shadcn UI, Framer Motion, Three.js.

Planned on the Go backend (see `plan.md` for the full v1/v2/v3 breakdown): presigned-URL direct-to-MinIO uploads, video transcode pipeline (ffmpeg → HLS), WebSocket notifications, `asynq`-backed job queue with retry/backoff/DLQ, JWT auth, Prometheus/Grafana/OpenTelemetry observability.

## 🛠️ Tech Stack

### Frontend (current)
- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Object Storage:** [MinIO](https://min.io/) (S3 compatible)
- **Queue & Caching:** [Redis](https://redis.io/) (via ioredis)
- **Image Processing:** [Sharp](https://sharp.pixelplumbing.com/)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/) & [React Three Fiber](https://r3f.docs.pmnd.rs/)

### Backend (in progress)
- **Language:** Go 1.22+ · **HTTP:** `chi` · **DB:** PostgreSQL via `GORM` · **Migrations:** `GORM AutoMigrate` (+ hand-written SQL for destructive changes) · **Queue:** Redis + `asynq` · **Storage:** MinIO · **Auth:** JWT (`golang-jwt`) + bcrypt · **Video:** `ffmpeg` · **Logging:** `zerolog` · **Metrics:** Prometheus · **Tracing:** OpenTelemetry

Full rationale for each choice is in `plan.md`.

## ⚙️ Getting Started — Frontend

### Prerequisites
- Node.js (v20+)
- Docker and Docker Compose (for PostgreSQL, MinIO, and Redis)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd optiflow
   ```

2. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file inside `frontend/` (Next.js only reads `.env` from its own project root):
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/optiflow"
   NEXTAUTH_SECRET="your-secret"
   NEXTAUTH_URL="http://localhost:3000"

   MINIO_ENDPOINT="localhost"
   MINIO_PORT=9000
   MINIO_USE_SSL=false
   MINIO_ACCESS_KEY="minioadmin"
   MINIO_SECRET_KEY="minioadmin"
   MINIO_IMAGE_BUCKET="images"
   MINIO_PUBLIC_URL="http://localhost:9000"

   REDIS_URL="redis://localhost:6379"
   ```

4. **Start the infrastructure (from repo root):**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations (from `frontend/`):**
   ```bash
   npx prisma migrate dev
   ```

6. **Seed the database (optional):**
   ```bash
   npm run seed
   ```

### Running the frontend

```bash
cd frontend
npm run dev      # Next.js dev server
npm run worker   # background worker (thumbnail generation)
```

## ⚙️ Getting Started — Backend (Go)

```bash
# local dev stack for the Go services: Postgres :5435, Redis :6381, MinIO :9010-9011.
# Ports are offset from defaults to avoid colliding with the frontend's docker-compose.yaml
# and any locally-installed Postgres/Redis — don't run both compose files at once regardless.
docker compose -f deploy/compose/docker-compose.yaml up -d

cd backend
cp cmd/auth-svc/.env.example cmd/auth-svc/.env       # then edit JWT_SECRET
cp cmd/api-svc/.env.example cmd/api-svc/.env         # JWT_SECRET must match auth-svc's — same tokens, all services validate them
cp cmd/upload-svc/.env.example cmd/upload-svc/.env   # same JWT_SECRET again; MINIO_* defaults already match deploy/compose

go run ./cmd/auth-svc     # :8081 — signup/login/refresh, JWT access+refresh, GORM AutoMigrate on startup
go run ./cmd/api-svc      # :8082 — folders + file metadata, JWT-protected, GORM AutoMigrate on startup
go run ./cmd/upload-svc   # :8083 — presigned direct-to-MinIO upload, JWT-protected, GORM AutoMigrate on startup
go run ./cmd/notify-svc   # :8084/healthz (scaffold)

# build / vet / test everything
go build ./...
go vet ./...
go test ./... -race -cover
```

### auth-svc endpoints (implemented)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/signup` | `{email, password, name}` | 201 + `{access_token, refresh_token}`, 409 if email taken |
| POST | `/login` | `{email, password}` | 200 + `{access_token, refresh_token}`, 401 on bad credentials |
| POST | `/refresh` | `{refresh_token}` | 200 + `{access_token}`, 401 if invalid/expired/wrong token type |
| GET | `/healthz` | — | 200 `ok` |

Access tokens expire in 15 minutes, refresh tokens in 7 days (`internal/auth/jwt.go`). Passwords are bcrypt-hashed (`internal/auth/password.go`). The `users` table schema lives in `internal/models/user.go` and is applied via `GORM AutoMigrate` on every `auth-svc` startup.

### api-svc endpoints (implemented)

All routes below except `/healthz` require `Authorization: Bearer <access_token>` from `auth-svc`; every query is scoped to the token's user — there's no cross-user access.

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/folders/` | `{name, parent_id?}` | 201, 400 if `parent_id` doesn't belong to you |
| GET | `/folders/?parent_id=` | — | lists folders under `parent_id` (root if omitted) |
| GET | `/folders/{id}` | — | folder + its immediate child folders and files, 404 if not yours |
| PATCH | `/folders/{id}` | `{name?, parent_id?}` | rename and/or move; rejects moving a folder into itself or a descendant (400) |
| DELETE | `/folders/{id}` | — | 204; cascades to all descendant folders and files, transactional |
| GET | `/files/?folder_id=` | — | lists files in `folder_id` (root if omitted) |
| GET | `/files/{id}` | — | 404 if not yours |
| PATCH | `/files/{id}` | `{name?, folder_id?}` | rename and/or move |
| DELETE | `/files/{id}` | — | 204; metadata-only — doesn't touch MinIO, since nothing writes real object bytes yet |
| GET | `/healthz` | — | 200 `ok`, no auth required |

There's no `POST /files` — file rows are only created by `upload-svc`, below.

### upload-svc endpoints (implemented)

Direct-to-MinIO upload, per `claude.md`'s rule against buffering file bytes through an HTTP handler — the app server never sees the file's contents. Both routes require `Authorization: Bearer <access_token>`.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/uploads/presign` | `{name, size_bytes, mime_type, folder_id?}` | 201 + `{file_id, upload_url, expires_at}`; creates a `File` row with `status: pending`; `upload_url` is a MinIO presigned PUT valid for 15 minutes |
| POST | `/uploads/{id}/complete` | — | 200 + updated file; verifies the object actually landed in MinIO via `StatObject` before flipping `status` to `ready` (client-reported completion isn't trusted); 400 if the object isn't there, 409 if already completed |
| GET | `/healthz` | — | 200 `ok`, no auth required |

Client flow: `POST /uploads/presign` → `PUT` the file's bytes straight to `upload_url` → `POST /uploads/{id}/complete`. If a client presigns and never uploads, the `File` row is left at `status: pending` indefinitely — there's no cleanup job for abandoned uploads yet (a `v2`-ish hardening gap, not currently tracked in `plan.md`).

`notify-svc` only exposes `/healthz` so far. `image-worker`/`video-worker` are no-op stubs pending the `asynq` queue integration (Phase v1, see `plan.md`).

## 🖼️ Thumbnail Generation (frontend, current)

The frontend includes a dedicated worker (`frontend/workers/worker.ts`) that listens to a Redis queue (`processing_queue`). When an image is uploaded, a job is added to the queue. The worker then:
1. Picks up the job and marks the storage record as `PROCESSING`.
2. Fetches the original image from MinIO.
3. Uses **Sharp** to resize the image to 800x600 (maintaining aspect ratio).
4. Converts the image to JPEG format.
5. Uploads the processed thumbnail back to MinIO with a `processed-` prefix.
6. Updates the storage record status to `COMPLETED` and stores the `processed_url`.

This will be superseded by the Go `image-worker` + `asynq` once the backend's job pipeline (Phase v1 of `plan.md`) is wired up.

## 🚀 CI/CD Pipeline & Docker Image

GitHub Actions builds/tests/pushes the **frontend** (the Go backend has no CI job yet).

### Pipeline Flow
1. **Push/PR to `main`**: `Frontend CI` workflow runs in `frontend/` — installs dependencies, ESLint, TypeScript type check, `next build`.
2. **Push to `main`**: `Build and Push Docker Image` workflow builds `frontend/dockerfile` (context `./frontend`) and pushes to Docker Hub.

### Setting Up GitHub Secrets

Configure in `Settings` > `Secrets and variables` > `Actions`:
- `DOCKER_USERNAME`: Docker Hub username.
- `DOCKER_PASSWORD`: Docker Hub password or Personal Access Token (PAT).
- `NEXT_PUBLIC_API_URL`: Public API URL for the frontend (e.g., `https://optiflow.example.com`).

### Infrastructure Validation

The NGINX reverse proxy exposes a health check endpoint at `/health` for the frontend stack. Each Go service exposes its own `/healthz`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. Read `claude.md` first — it documents this repo's conventions (error handling, no dead/unwired code, migration rules, async job requirements).

## 📄 License

This project is licensed under the MIT License.
