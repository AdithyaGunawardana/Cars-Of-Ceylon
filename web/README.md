# Cars-Of-Ceylon Web App

Next.js application for the web-first product experience.

## Strategy

- Web is the primary product surface.
- Mobile is built in parallel against stable web APIs.
- Backend contracts are shared by web and mobile clients.

For cross-platform features, follow this sequence:

1. Define API contract and permissions
2. Implement web flow
3. Implement mobile flow
4. Validate both clients with the same acceptance criteria

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Prisma + PostgreSQL
- Auth.js (NextAuth)
- Docker Compose for local app + DB

## Run Locally (Docker Recommended)

From repository root:

```bash
docker compose up --build
```

In a second terminal:

```bash
docker compose exec web npx prisma migrate dev --name init
docker compose exec web npm run prisma:seed
```

Open:

- <http://localhost:3000>
- MinIO API: <http://localhost:9000>
- MinIO Console: <http://localhost:9001> (minioadmin / minioadmin)

## Run Locally (Without Docker)

From `web/`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Ensure `DATABASE_URL` in `.env` points to your PostgreSQL instance.

## Current API Foundation

- `POST /api/auth/register`
- `GET /api/vehicles`
- `POST /api/vehicles` (authenticated)
- `GET /api/vehicles/:id`
- `PATCH /api/vehicles/:id` (authenticated, owner/moderator/admin)
- `DELETE /api/vehicles/:id` (authenticated, owner/moderator/admin)
- `POST /api/vehicles/:id/events` (authenticated, owner/moderator/admin)
- `POST /api/vehicles/:id/photos/upload-url` (authenticated, owner/moderator/admin)
- `POST /api/vehicles/:id/photos/finalize` (authenticated, owner/moderator/admin; finalize by `storageKey`)
- `POST /api/reports` (authenticated; create moderation report)
- `GET /api/reports` (moderator/admin report queue)
- `PATCH /api/reports/:id` (moderator/admin status update)

## Current Web Routes

- `/vehicles`
- `/vehicles/[id]`
- `/vehicles/new`
- `/moderation/reports` (moderator/admin)
- `/login`
- `/register`

The global top navigation now links to Moderation for moderator/admin users only.

Vehicle detail now includes owner/moderator/admin controls to update metadata and delete entries.

## Development Guidelines

- Keep validation and business rules server-side.
- Keep response shapes consistent and mobile-friendly.
- Add or update API contracts before building cross-platform UI.
- Use feature flags when a feature is not fully ready on both clients.

## Shared API Contracts

The backend now centralizes request/response schemas so web and mobile can stay aligned on stable payload shapes.

- Shared error contract: `src/lib/contracts/api-contracts.ts`
- Vehicle and event contracts: `src/lib/contracts/vehicle-contracts.ts`
- Photo upload/finalize contracts: `src/lib/contracts/photo-contracts.ts`

Current route handlers import these contracts directly, and route tests assert response payloads against the same schemas.

## Upload Storage Configuration

Set the following variables in `web/.env` for signed image uploads:

- `UPLOAD_S3_ENDPOINT`
- `UPLOAD_S3_REGION`
- `UPLOAD_S3_BUCKET`
- `UPLOAD_S3_ACCESS_KEY_ID`
- `UPLOAD_S3_SECRET_ACCESS_KEY`
- `UPLOAD_S3_PUBLIC_BASE_URL` (optional)

Current upload limits:

- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Max size: 10 MB

For Docker Compose, these variables are already configured to use the local MinIO bucket `cars-of-ceylon`.

## API Smoke Check

With the app stack running, execute:

```bash
cd web
npm run smoke:api
```

Optional override:

```bash
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:api
```
