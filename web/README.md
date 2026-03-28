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
```

Open:

- http://localhost:3000

## Run Locally (Without Docker)

From `web/`:

```bash
npm install
npm run prisma:generate
npm run dev
```

Ensure `DATABASE_URL` in `.env` points to your PostgreSQL instance.

## Current API Foundation

- `POST /api/auth/register`
- `GET /api/vehicles`
- `POST /api/vehicles` (authenticated)
- `GET /api/vehicles/:id`

## Development Guidelines

- Keep validation and business rules server-side.
- Keep response shapes consistent and mobile-friendly.
- Add or update API contracts before building cross-platform UI.
- Use feature flags when a feature is not fully ready on both clients.
