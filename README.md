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
	- `POST /api/vehicles/:id/events` (authenticated, owner/moderator/admin)
	- `POST /api/vehicles/:id/photos/upload-url` (authenticated, owner/moderator/admin)
	- `POST /api/vehicles/:id/photos` (authenticated, owner/moderator/admin; finalize by `storageKey`)
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

2. In another shell, run the first migration inside app container:

```bash
docker compose exec web npx prisma migrate dev --name init
docker compose exec web npm run prisma:seed
```

3. Open:

- App: http://localhost:3000
- PostgreSQL: localhost:5432
- MinIO S3 API: http://localhost:9000
- MinIO Console: http://localhost:9001

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