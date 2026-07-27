# OptiFlow – Feature Specification

OptiFlow is a file management and processing platform built with Next.js (App Router), Prisma/PostgreSQL, MinIO object storage, and Redis. Users upload, organize, share, and preview files; uploaded images are asynchronously thumbnailed by a background worker.

> This document reflects the **current implementation** (verified against the codebase). A separate "Planned / Not Yet Implemented" section at the end lists roadmap items that exist only as ideas (see `FUNCTIONALITY_IDEAS.md`) or as dead/orphaned code.

## Core System Overview

```
Client (Next.js dashboard)
  |
Next.js API routes (app/api/**)
  |                \
  |                 -> Postgres (Prisma)
  |
Redis list "processing_queue"  (image uploads only)
  |
Worker (workers/worker.ts, run via `npm run worker`)
  |
MinIO (buckets: images, files)
```

Upload flow:
1. User uploads a file via the dashboard (`app/dashboard/files/page.tsx` → `POST /api/storage`).
2. File is validated (MIME type + size) and streamed to a MinIO bucket.
3. A `storage` row is created in Postgres with `status: PENDING`.
4. If the upload is an **image**, its `storage.id` is pushed onto the Redis list `processing_queue`.
5. The worker (`workers/worker.ts`) blocks on `BRPOP processing_queue`, downloads the original from MinIO, generates an 800×600 JPEG thumbnail with Sharp, uploads it back as `processed-<filename>`, and sets `status: COMPLETED` + `processed_url`.
6. Non-image files are stored but never enter the queue — they remain `status: PENDING` indefinitely (by design; there is no processing pipeline for non-image types).
7. A `notification` row is created for upload/version/rename/delete/share events; the notification bell polls `GET /api/notifications` every 30 seconds (no WebSocket/SSE).

**Note:** the worker is **not** part of `docker-compose.yaml` — it must be started separately with `npm run worker` for image processing to run at all.

---

## Feature List

### 1. Authentication
- **NextAuth v5 (beta)**, JWT session strategy, custom `/signin` page.
- **Credentials provider**: email + bcrypt-hashed password (cost 12), validated with Zod.
- **GitHub OAuth provider**: first login auto-creates/upserts a `user` + linked `account` row.
- Sign-up is a separate custom endpoint, `POST /api/auth/signup` (not a NextAuth route) — checks for duplicate email, hashes password, returns 201/409/422.
- Not implemented: password reset, email verification, 2FA/TOTP, password-change after signup.

### 2. File Upload
- `POST /api/storage` — multipart form (`file`, `type: "image"|"file"`, optional `folderId`), requires an authenticated session.
- Validation (`lib/validations/storage.ts`):
  - Images (jpeg/png/gif/webp/svg+xml): max **10 MB**.
  - Documents (+ pdf/txt/doc/docx): max **50 MB**.
- Stored in MinIO bucket `images` or `files`; object key = `${uuid}-${originalFilename}`.
- Re-uploading a file with the same name creates a **new version** (previous state archived as a child `storage` row via `parent_id`, `version` incremented) rather than overwriting.
- `GET /api/storage` — list current user's root files, filterable by `folderId` or `search` (case-insensitive filename match).
- `GET /api/storage/[id]` / `PATCH` (rename) / `DELETE` (cascades to version history) / `POST` (upload new version).
- `GET /api/storage/[id]/versions` — version history for a file.
- `GET /api/storage/[id]/download?preview=true` — streams the file from MinIO (inline for preview, attachment otherwise); this route has **no auth check** by design, since it also serves shared-link recipients.
- All uploads are buffered through the Next.js server (no S3 presigned direct-upload); nginx allows bodies up to 500 MB, but Zod validation caps effective size at 10/50 MB regardless.
- The drag-and-drop progress UI (`components/file-upload.tsx`) is currently a **disconnected mock** (simulated progress via `setInterval`, no real API call) — the actual upload path used in the dashboard is a plain `axios.post` with no progress bar or chunking.
- Chunked upload support (`lib/uploadFile.ts`, `file`/`chunk` Prisma models) exists as orphaned server-side code — no API route or UI wires it up.

### 3. Folder Management
- `POST /api/folder` — create folder (`name`, optional `parentId`).
- `GET /api/folder` — list folders by `parentId`/`search`, with child/file counts.
- `GET /api/folder/[id]` — folder detail (immediate children + files), ownership-checked.
- `PUT /api/folder/[id]` — rename and/or reparent.
- `DELETE /api/folder/[id]` — only if empty (409 otherwise).
- Nested folders are fully supported server-side. **The UI only wires up "Create" and "navigate into a folder"** — the per-folder Rename/Move/Delete menu items in `app/dashboard/files/page.tsx` currently have no click handlers.
- Sidebar "Trash" link is a placeholder (`href="#"`); there is no recycle bin — deletes are permanent (hard delete).

### 4. Background Image Processing (Worker)
- `workers/worker.ts` runs an infinite loop on `redis.brpop("processing_queue", 0)` — a **plain Redis list**, not a job-queue framework (BullMQ is not a dependency).
- Pipeline: mark `PROCESSING` → download original from MinIO → Sharp resize to 800×600 (`fit: inside`) → convert to JPEG → upload as `processed-<name>` → mark `COMPLETED`, set `processed_url`.
- On any error the job is marked `FAILED` and abandoned — **no retry, no exponential backoff, and no dead-letter queue.**
- `storageStatus` enum: `PENDING | PROCESSING | COMPLETED | FAILED`.
- `scripts/enqueue.ts` / `scripts/monitor-queue.ts` reference a differently-named queue key (`image-processing-queue`) than the one actually used in production (`processing_queue`) — these scripts are stale and not part of the working pipeline.

### 5. Sharing
- `POST /api/share` — body `{ storageId, recipientEmail?, expiresAt? }`. Generates a `nanoid()` token (21 chars) as the share's primary key. If `recipientEmail` resolves to an existing user, the share is targeted to them and a `SHARE` notification is created.
- `GET /api/share` — lists files shared **with** the current user (non-expired only).
- `GET /api/share/[token]` — public (no auth) resolution of a token to file metadata + download/preview URLs; returns `410 Gone` if expired.
- `app/share/[token]/page.tsx` — public landing page with a "Download Securely" button.
- Supports both anonymous public links and directed user-to-user sharing by email.
- Not implemented: password-protected links, download-count limits, viewer/editor permission levels.

### 6. Notifications
- DB-backed, **polling only** — no WebSocket/SSE.
- `components/notifications-popover.tsx` fetches on mount, then polls `GET /api/notifications` every 30 seconds (plus on dropdown open).
- `GET /api/notifications` — last 30 notifications + unread count.
- `PATCH /api/notifications` — mark one (`notificationId`) or all (`markAll: true`) as read.
- Triggered by: file upload/new version, rename, delete, and directed share. `notification.type` enum is `SHARE | SYSTEM | STORAGE`, but `SYSTEM` is never actually emitted by current code.

### 7. Analytics
- `GET /api/analytics` — live-computed `{ totalFiles, totalStorageUsed, uploadsThisMonth, fileTypes: { IMAGE, FILE } }`. No caching, no stored time-series.
- Dashboard overview shows this as stat cards + a real donut chart (file type distribution) and an **"Upload Velocity" area chart that is mock data** — split from `uploadsThisMonth` into 4 arbitrary buckets client-side, since no historical/daily data is available from the API.

### 8. Profile / Account
- `GET /api/profile` — user fields (name, username, email, bio, avatar_url) + stats (storage used, file count, storage limit).
- `PATCH /api/profile` — update name/username/bio/avatar_url.
- `storageLimit` is a **hardcoded 1 GB constant**, display-only — not configurable and not enforced against uploads.
- No password-change endpoint exists.
- Profile page shows a static "PRO MEMBER" badge and an "Upgrade Plan" button with no handler (decorative; no billing integration).

### 9. Database (Prisma / Postgres)
Enums: `storageStatus` (PENDING/PROCESSING/COMPLETED/FAILED), `fileType` (IMAGE/FILE), `notificationType` (SHARE/SYSTEM/STORAGE).

Active models: `user`, `account` (NextAuth), `notification`, `folder` (self-referencing parent/children), `storage` (self-referencing versioning via `parent_id`), `shared_file` (token as PK).

Legacy/orphaned models (schema exists, no active route uses them): `file`, `chunk` — remnants of the unused chunked-upload path.

### 10. Dashboard UI
- `app/dashboard/page.tsx` — Overview: stat cards, file-type donut (real data), upload velocity chart (mock data, see §7).
- `app/dashboard/files/page.tsx` — main file manager: grid/list view, debounced search, folder creation, upload dialog, per-file actions (view/download/rename/new version/version history/create share link/delete — all wired), per-folder actions (rename/move/delete — **not wired**).
- `app/dashboard/shared/page.tsx` — read-only grid of files shared with the user.
- `app/dashboard/profile/page.tsx` — profile editor + storage usage bar + decorative upgrade CTA.
- `app/dashboard/layout.tsx` — auth-gated shell (redirects to `/signin` without a session), sidebar nav (Overview, My Files, Shared with me, Profile, Trash[dead link]).

### 11. Deployment & CI/CD
- `docker-compose.yaml`: `db` (Postgres 16), `storage` (MinIO), `redis`, `web` (Next.js standalone build), `nginx` (reverse proxy, `client_max_body_size 500M`, static `/health` endpoint). **No worker service in compose** — must be run manually alongside the stack.
- `dockerfile`: multi-stage Next.js standalone build, non-root user.
- GitHub Actions: `frontend-ci.yml` (lint, typecheck, build on push/PR to `main`); `deploy.yml` (build + push image to Docker Hub on push to `main`; no automatic deploy step to a server).

---

## Planned / Not Yet Implemented~

These are tracked as ideas in `FUNCTIONALITY_IDEAS.md` or exist as dead code, but are **not usable features today**:

- API keys for developers, external API access
- Webhook notifications on job completion
- Admin dashboard (system health, workers, queue size, user growth)
- Rate limiting per user/plan
- Prometheus/Grafana or any monitoring stack
- Retry mechanism / backoff / dead-letter queue for failed processing jobs
- Real-time job/notification updates (WebSocket or SSE) — currently 30s polling only
- Recycle bin / soft delete (deletes are permanent; "Trash" nav is a placeholder)
- Folder rename/move/delete from the UI (server routes exist, buttons are unwired)
- Password change, password reset, 2FA
- Storage quota enforcement (limit is displayed but never enforced)
- Chunked/resumable upload exposed to the frontend
- Drag-and-drop upload wired to the real API
- Password-protected or download-limited share links
- Viewer/editor permission levels on shares
- Batch file actions, ZIP download, move/copy between folders
- In-browser preview for PDFs/video/code
- Full-text / content search
- Video transcoding, OCR, AI tagging pipelines
- Billing/subscription plans (the "Upgrade Plan" button is decorative)
