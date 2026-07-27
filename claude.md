# CLAUDE.md

This file gives Claude (via Claude Code) the context needed to work on this repo consistently. Read this before making changes.

## Project

**StreamVault** — a multi-service Go backend, paired with a Next.js (App Router) frontend, for file & video upload, storage, sharing, and streaming preview. Rewrite of an earlier Next.js/Prisma project ("OptiFlow"); see `plan.md` for full architecture and the v1/v2/v3 roadmap.

The frontend is a client of the Go backend — it does not own business logic, DB access, or job processing. NextAuth (if used) is only for session-cookie glue; token authority lives in `auth-svc`.

Check `plan.md`'s current tier (v1/v2/v3) before adding a feature — don't build v2/v3 features (teams, search, webhooks, multi-region) into a service until v1 scope for that service is fully wired end-to-end.

## Tech Stack (authoritative — don't substitute without asking)

- Go 1.22+
- HTTP: `chi`
- DB: PostgreSQL via `sqlc` + `pgx`
- Migrations: `golang-migrate`
- Queue: Redis + `asynq`
- Object storage: MinIO (S3 API-compatible)
- Auth: JWT (access + refresh), bcrypt for password hashing
- Video: `ffmpeg` via `os/exec`
- Logging: `zerolog`, structured JSON
- Metrics: `prometheus/client_golang`
- Tracing: OpenTelemetry

## Repo Structure

This is a monorepo containing both the Go backend and the Next.js frontend, kept in separate top-level trees.

```
/backend
  /cmd
    /auth-svc/main.go
    /api-svc/main.go
    /upload-svc/main.go
    /image-worker/main.go
    /video-worker/main.go
    /notify-svc/main.go
    /search-indexer/main.go   # v2+
  /internal
    /auth        # token issuance/validation, shared across services
    /storage     # MinIO client wrapper
    /queue       # asynq client/task type definitions (shared task payloads)
    /events      # NATS publish/subscribe helpers (v2+)
    /db          # sqlc-generated code + queries/*.sql
    /models      # shared domain types
    /middleware  # rate limiting, auth, logging, request-id, circuit breakers (v2+)
  /migrations    # golang-migrate SQL files
/frontend
  /app           # Next.js App Router pages
  /components
  /lib           # API client (typed fetch/React Query hooks against backend), WS/SSE client
/deploy
  /docker        # per-service Dockerfiles (backend + frontend)
  /k8s           # manifests / Helm chart
  /compose       # docker-compose.yaml for local dev (all backend services + Postgres + Redis + MinIO + frontend)
/scripts         # one-off ops scripts (mark clearly if not wired into CI)
plan.md
claude.md
```

Each `/backend/cmd/*-svc` is an independently deployable binary. Shared backend logic lives in `/backend/internal`, never duplicated across services. The frontend never talks to Postgres/Redis/MinIO directly — always through the backend's HTTP API.

## Conventions

- **Errors**: always wrap with context (`fmt.Errorf("doing X: %w", err)`), never swallow silently. Services log errors as structured JSON with `zerolog`.
- **Config**: read from env vars only, no hardcoded connection strings. Provide a `.env.example` for every service that needs one.
- **DB queries**: write raw SQL in `/internal/db/queries/*.sql`, regenerate with `sqlc generate` — never hand-write query structs.
- **Async jobs**: every job type is defined once in `/internal/queue/tasks.go` (payload struct + task name constant), consumed by exactly one worker. Always configure retry count + backoff explicitly per task — no task should silently retry forever or never retry.
- **No dead code / no unwired features.** If an endpoint exists, it must have a caller. If a UI button or route is a placeholder, it must be labeled TODO with a tracking note, not shipped silently disconnected (this bit us in the old OptiFlow codebase — folder rename/move/delete existed server-side but had no UI wiring for months).
- **Tests**: table-driven Go tests, `_test.go` alongside source. Integration tests that touch Postgres/Redis/MinIO run against docker-compose services in CI, not mocks, where feasible.
- **Migrations**: never edit a migration that has been merged to `main`; always add a new one.

## Commands

```bash
# local dev stack (Postgres, Redis, MinIO, asynqmon)
docker compose -f deploy/compose/docker-compose.yaml up -d

# run a service locally
go run ./cmd/api-svc

# generate sqlc code after editing queries
sqlc generate

# create a new migration
migrate create -ext sql -dir migrations -seq <name>

# run migrations
migrate -path migrations -database "$DATABASE_URL" up

# lint / vet / test
golangci-lint run ./...
go vet ./...
go test ./... -race -cover
```

## What Claude should do by default in this repo

- When adding a new async job type, always add: task struct in `/internal/queue`, handler in the correct worker's `main.go` or a dedicated `handlers.go`, retry/backoff config, and a Prometheus counter for success/failure.
- When adding a new endpoint, add it to the relevant service only (don't put upload logic in `api-svc`, don't put metadata logic in `upload-svc`).
- When touching video/image processing, assume ffmpeg/imaging calls are slow and must run inside a worker via the queue — never inline in an HTTP handler.
- Prefer explicit, typed SQL (`sqlc`) over adding an ORM.
- Update `plan.md`'s roadmap section if a phase's scope materially changes.
- Flag (don't silently fix) any place where a feature looks half-wired — surface it rather than guessing intent.

## What Claude should avoid

- Don't reintroduce a plain Redis list for queueing — use `asynq` so retries/backoff/DLQ stay consistent everywhere.
- Don't buffer large file/video uploads through an HTTP handler — use presigned MinIO URLs.
- Don't add a new internal service without updating the architecture diagram in `plan.md`.
- Don't hardcode secrets or connection strings anywhere in `/cmd` or `/internal`.