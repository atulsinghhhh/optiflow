# StreamVault (formerly OptiFlow)

[![Frontend CI](https://github.com/atulsinghhhh/optiflow/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/atulsinghhhh/optiflow/actions/workflows/frontend-ci.yml)
[![Deploy to Production](https://github.com/atulsinghhhh/optiflow/actions/workflows/deploy.yml/badge.svg)](https://github.com/atulsinghhhh/optiflow/actions/workflows/deploy.yml)

StreamVault is a file & video upload, storage, sharing, and streaming-preview platform. It's a from-scratch rewrite of the original OptiFlow (Next.js + Prisma monolith) into a **Go multi-service backend paired with a Next.js frontend**. See [`plan.md`](./plan.md) for the full architecture and v1/v2/v3 roadmap, and [`claude.md`](./claude.md) for engineering conventions.

> **Status:** the Next.js frontend below is the original, fully working OptiFlow app. The Go backend (`/backend`) is a fresh scaffold — service skeletons with health checks only, no business logic wired yet. The frontend still talks to its own Next.js API routes / Prisma / MinIO directly; it has not been switched over to the Go backend yet.

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
  /internal          # auth, storage, queue, db, models, middleware (shared, unexported)
  /migrations        # golang-migrate SQL files
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
- **Language:** Go 1.22+ · **HTTP:** `chi` · **DB:** PostgreSQL via `sqlc` + `pgx` · **Migrations:** `golang-migrate` · **Queue:** Redis + `asynq` · **Storage:** MinIO · **Auth:** JWT (`golang-jwt`) + bcrypt · **Video:** `ffmpeg` · **Logging:** `zerolog` · **Metrics:** Prometheus · **Tracing:** OpenTelemetry

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

## ⚙️ Getting Started — Backend (Go, scaffold)

```bash
# local dev stack for the Go services (separate Postgres/Redis/MinIO from the frontend stack —
# don't run both compose files at once, ports collide)
docker compose -f deploy/compose/docker-compose.yaml up -d

# run a service
cd backend
go run ./cmd/api-svc      # :8082/healthz
go run ./cmd/auth-svc     # :8081/healthz
go run ./cmd/upload-svc   # :8083/healthz
go run ./cmd/notify-svc   # :8084/healthz

# build / vet / test everything
go build ./...
go vet ./...
go test ./... -race -cover
```

No business logic is wired yet — each `-svc` only exposes `/healthz`, and `image-worker`/`video-worker` are no-op stubs pending the `asynq` queue integration (Phase v1, see `plan.md`).

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
