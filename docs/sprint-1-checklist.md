# Sprint 1 Checklist

## Scope

- Public vehicle list with filters
- Vehicle detail page with timeline and photo section
- Authenticated create vehicle flow
- Initial migration and seed workflow

## API Acceptance

- [ ] `GET /api/vehicles` returns public records and supports search filters
- [ ] `GET /api/vehicles/:id` returns vehicle with events and photos
- [ ] `POST /api/vehicles` requires authentication
- [ ] `POST /api/vehicles` rejects invalid input with 400
- [ ] Duplicate unique identifier or license plate is blocked

## Web Acceptance

- [ ] `/vehicles` lists vehicles and allows filtering
- [ ] `/vehicles/[id]` displays metadata, timeline, and photo placeholders
- [ ] `/vehicles/new` is gated for signed-in users
- [ ] Successful create redirects to detail page
- [ ] Validation and duplicate errors show user-friendly messages

## Data and Tooling Acceptance

- [ ] Initial migration exists in `web/prisma/migrations/202603280001_init/migration.sql`
- [ ] Seed script creates or updates admin user
- [ ] Seed script inserts sample vehicles
- [ ] `npm run prisma:seed` executes successfully

## Verification Commands

```bash
cd web
npm run prisma:generate
npm run lint
npm run build
```

## Notes

- Docker is recommended for local app + PostgreSQL startup.
- If Docker is unavailable, use a local PostgreSQL instance and set `DATABASE_URL` in `.env`.
