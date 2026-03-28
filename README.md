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
```

3. Open:

- App: http://localhost:3000
- PostgreSQL: localhost:5432

## Local (Non-Docker) Run

From `web/`:

```bash
npm install
npm run prisma:generate
npm run dev
```

Set `DATABASE_URL` in `web/.env` to a reachable PostgreSQL instance.