# Cars-Of-Ceylon

A web-based car archive for Sri Lankan automobiles, focused on preserving vehicle history, albums, and community contributions.

## Product Direction

- Web-first development for speed, SEO, and product stability
- Mobile app developed in parallel using the same backend contracts
- Single backend and shared domain model for both clients

## Execution Model

Each cross-platform feature should follow this order:

1. API contract (request, response, validation, permissions)
2. Web implementation
3. Mobile implementation
4. Shared verification across web and mobile

This prevents API drift and keeps behavior consistent across platforms.

## Current Stack

- Next.js (React + TypeScript)
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Auth.js (NextAuth)
- Docker + Docker Compose

## Planned Mobile Stack

- React Native + Expo
- Shared backend APIs from web
- Secure token-based mobile auth flow
- Same moderation and audit rules as web

## Mobile Scaffold Status

- Baseline app scaffold is now available under `mobile/`
- Initial screens: login + vehicles list/detail preview
- API-first implementation aligned with shared web contracts

## Implemented Foundation

- Project scaffolded under `web/`
- Prisma domain models for:
  - users and roles
  - vehicles
  - vehicle events (history timeline)
  - vehicle photos
  - follow relationships
  - moderation reports
- Auth scaffolding:
  - email/password credentials
  - optional Google and Apple providers
- API routes:
  - `POST /api/auth/register`
  - `GET /api/vehicles`
  - `POST /api/vehicles` (authenticated)
  - `GET /api/vehicles/:id`
  - `PATCH /api/vehicles/:id` (authenticated, owner/moderator/admin)
  - `DELETE /api/vehicles/:id` (authenticated, owner/moderator/admin)
  - `POST /api/vehicles/:id/events` (authenticated, owner/moderator/admin)
  - `PATCH /api/vehicles/:id/events/:eventId` (authenticated, owner/moderator/admin)
  - `DELETE /api/vehicles/:id/events/:eventId` (authenticated, owner/moderator/admin)
  - `POST /api/vehicles/:id/photos/upload-url` (authenticated, owner/moderator/admin)
  - `POST /api/vehicles/:id/photos/finalize` (authenticated, owner/moderator/admin; finalize by `storageKey`)
  - `PATCH /api/vehicles/:id/photos/:photoId` (caption), `DELETE /api/vehicles/:id/photos/:photoId` (owner/moderator/admin)
  - `POST /api/reports` (authenticated; create moderation report)
  - `GET /api/reports` (moderator/admin report queue)
  - `PATCH /api/reports/:id` (moderator/admin status update)
- Web routes:
  - `/vehicles` (list and filter)
  - `/vehicles/[id]` (detail)
  - `/vehicles/new` (authenticated create form)
  - `/login`
  - `/register`

## Parallel Roadmap (Web + Mobile)

1. Stabilize API contracts for core entities (vehicles, events, photos, moderation)
2. Complete web feature flows first for each slice
3. Implement matching mobile flows on stable endpoints
4. Run shared QA on the same acceptance checklist
5. Add platform-specific polish after parity

## Run With Docker

1. Start containers from repository root:

```bash
docker compose up --build
```

1. In another shell, run the first migration inside app container:

```bash
docker compose exec web npx prisma migrate dev --name init
docker compose exec web npm run prisma:seed
```

1. Open:

- App: <http://localhost:3000>
- PostgreSQL: localhost:5432
- MinIO S3 API: <http://localhost:9000>
- MinIO Console: <http://localhost:9001>

## Local (Non-Docker) Run

From `web/`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Set `DATABASE_URL` in `web/.env` to a reachable PostgreSQL instance.

For signed photo uploads, also configure in `web/.env`:

- `UPLOAD_S3_ENDPOINT`
- `UPLOAD_S3_REGION`
- `UPLOAD_S3_BUCKET`
- `UPLOAD_S3_ACCESS_KEY_ID`
- `UPLOAD_S3_SECRET_ACCESS_KEY`
- `UPLOAD_S3_PUBLIC_BASE_URL` (optional; defaults to endpoint-based URL)

When using Docker Compose in this repository, these upload variables are pre-wired to the local MinIO service.

Upload constraints currently enforced server-side:

- Allowed image types: JPEG, PNG, WebP
- Maximum file size: 10 MB

## Sprint 1 Tracking

- Use the acceptance checklist in `docs/sprint-1-checklist.md` while implementing and validating the first vertical slice.

## Sprint 2 Tracking

- Use `docs/sprint-2-checklist.md` for timeline/photo contribution and auth UX acceptance.

## Sprint 3 Tracking

- Use `docs/sprint-3-checklist.md` for signed upload flow and photo finalization acceptance.

## Sprint 4 Tracking

- Use `docs/sprint-4-checklist.md` for moderation report APIs and moderator queue acceptance.

## Sprint 5 Tracking

- Use `docs/sprint-5-checklist.md` for timeline event management expansion, photo UX resilience, moderation hardening, and mobile baseline acceptance.

## Sprint 6 Tracking

- Use `docs/sprint-6-checklist.md` for mobile parity across vehicles, events, photos, moderation, plus profile/follow and search/discovery improvements.
- Sprint 6 is now implemented across web and the restored `mobile/` scaffold.

## Shared Contract Modules

For cross-platform API stability, request/response contracts are centralized in:

- `web/src/lib/contracts/api-contracts.ts`
- `web/src/lib/contracts/vehicle-contracts.ts`
- `web/src/lib/contracts/photo-contracts.ts`
- `web/src/lib/contracts/user-contracts.ts`

Web route handlers and API tests should import these directly so mobile can reuse the same payload expectations.

## Security Hardening (P0)

- Report workflow is enforced server-side: `PENDING -> REVIEWING -> RESOLVED | REJECTED` (409 otherwise); `moderatedAt` is recorded.
- `POST /api/reports`: 5 reports / 15 min per user (429 + `Retry-After`), one open report per user per vehicle, private vehicles are 404 to non-viewers.
- `POST /api/auth/register` is limited to 10 / hour / IP; credential login is limited per email+IP and per IP. Limiter is in-memory (per instance) — move to Redis before scaling out.
- Emails are normalized to lowercase. Emails are only returned to the account owner and admins.
- Photo uploads: storage key = `vehicles/{vehicleId}/{userId}/{ts}-{uuid}.{ext}` (extension from validated MIME type). The presigned PUT signs `Content-Length` and `Content-Type`. Finalize checks key ownership, `HeadObject` size/type, and rejects replays (unique `storageKey`).
- Moderators/admins can view private vehicles (API and pages).
- `src/proxy.ts` blocks cross-origin state-changing `/api/*` requests that carry a mismatching `Origin`. Security headers are set in `next.config.ts`.
- Seed: `SEED_ADMIN_PASSWORD` is required in production; re-running the seed no longer resets the admin password.
- Deploy: apply migration `20261113000001_p0_hardening` (`prisma migrate deploy`). It lowercases existing emails — resolve case-duplicate accounts first.
- Windows note: run `npm test` from a path with an uppercase drive letter (`D:\...`); a lowercase `d:` cwd duplicates the vitest module instance and every suite fails with `Cannot read properties of undefined (reading 'config')`.

## Local Infra Quickstart (Windows-friendly)

Run Postgres + MinIO in Docker and the app on the host:

```bash
docker compose up -d db minio minio-init
cd web
npx prisma migrate deploy      # NOT `migrate dev --name init` — migrations already exist
npm run prisma:seed
npm run dev
```

If a native PostgreSQL already uses port 5432, create a root `.env` with `DB_PORT=5433` and use `...@localhost:5433/...` in `web/.env`.

## Testing

From `web/` (Docker `db` + `minio` must be running for the last two):

| Command | What it covers |
|---|---|
| `npm run lint` / `npx tsc --noEmit` | Static checks |
| `npm test` | Unit/contract tests with mocked Prisma (no services needed) |
| `npm run test:integration` | Route handlers against real Postgres + MinIO (dedicated `cars_of_ceylon_test` DB and bucket, created automatically) |
| `npm run test:e2e` | Playwright browser tests against a production build on port 3100 (first run: `npx playwright install chromium`) |

CI (`.github/workflows/web-ci.yml`) runs all of them. Set `INTEGRATION_DATABASE_URL` / `INTEGRATION_S3_ENDPOINT` to point the integration/E2E suites at other services.
