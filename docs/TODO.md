# Cars of Ceylon - Completion TODO

Source of truth for remaining work. Derived from the 2026-11-13 repo audit. Update as items land.

## P0 - Security and correctness (DONE)
- [x] Upgrade Next, next-auth, zod; `npm audit --omit=dev` clean (8 dev-only findings remain in vite/esbuild/minimatch)
- [x] Photo finalize: key bound to vehicle+user, HeadObject size/type check, replay protection (unique `storageKey`)
- [x] Upload: extension from MIME, signed `Content-Length` + `Content-Type`
- [x] Emails hidden except for the account owner and admins
- [x] Rate limits: reports (5/15min), register (10/h/IP), login (per email+IP, per IP)
- [x] Lowercase emails (+ migration)
- [x] Report workflow `PENDING -> REVIEWING -> RESOLVED|REJECTED`, `moderatedAt`, no duplicate open reports, private-vehicle rules
- [x] Moderators/admins can view private vehicles
- [x] Security headers + cross-origin mutation guard (`src/proxy.ts`)
- [x] Seed: no default password in production, no admin password reset
- [x] Event `sourceUrl` restricted to http(s) (blocks `javascript:` links)

## P1 - Close gaps from earlier sprints (DONE, verified in a real browser during P2)
- [x] Real photo thumbnails + lightbox in the web album
- [x] Web timeline edit/delete UI, ordered by `occurredAt`
- [x] Web upload: staged status, progress bar, cancel, retry
- [x] Photo endpoints: `PATCH` caption, `DELETE` (also removes the stored object)
- [x] `/vehicles` pagination using the shared query schema (`lib/vehicle-queries.ts`)
- [x] `role` in the session/JWT; layout no longer queries the DB per request; mobile Reports screen is role-aware
- [x] Sprint checklists and `API_CONTRACTS.md` corrected
- [x] Fixed: timeline form sent `datetime-local` values the API rejected (now ISO)

## P2 - Refactor and test properly (DONE)
- [x] Shared authz guards (`lib/api-auth.ts`: `requireSession`, `resolveModerator`, `resolveVehicleManager`) used by every protected route
- [x] Shared data access: `getVehicleDetail`, `listPublicVehicles`, `listReports` used by both API routes and pages
- [x] Strict response schemas (`lib/contracts/response-schemas.ts`) validated against real responses in integration tests
- [x] Integration tests against real Postgres + MinIO (`npm run test:integration`, dedicated `cars_of_ceylon_test` DB and `cars-of-ceylon-test` bucket)
- [x] Playwright browser E2E (`npm run test:e2e`): register -> create vehicle -> timeline -> upload photo -> lightbox -> report -> moderate, plus HTTP-level security checks
- [x] CI runs lint, tsc, unit, build, integration and E2E (`.github/workflows/web-ci.yml`)
- [x] The ad-hoc live-stack script is superseded by the integration + E2E suites
- Bugs the new tests found and fixed: duplicate vehicle create returned 500 (now 409); nav stayed on "Sign In" after login; create-vehicle redirect was swallowed by a try/catch; report form hung after submit (`event.currentTarget` read after `await`)

## P3 - Features needed to call it complete
- [ ] Profile editing (name, bio, avatar), account settings, password reset, email verification
- [ ] Vehicle soft delete, moderation audit log, orphaned S3 object cleanup
- [ ] Moderation actions beyond status changes (hide content, ban user)
- [ ] Discovery: full-text search, sorting, year range, follow feed
- [ ] Use `attributes` JSON in forms and filters
- [ ] SEO (`generateMetadata`, sitemap, OG images); `error.tsx`, `not-found.tsx`, `loading.tsx`
- [ ] S3/R2 production buckets need a CORS rule allowing `PUT` from the site origin (MinIO allows it by default, which is why the browser E2E passes)
- [ ] Real landing page; one UI theme everywhere (moderation + login pages still partly use the old zinc theme)

## P4 - Mobile
- [ ] Fix tsconfig (`ignoreDeprecations`), align deps with Expo 53 (`npx expo install --fix`), add ESLint config
- [ ] Split `App.tsx` into screens (expo-router / React Navigation)
- [ ] Token-based auth in `expo-secure-store` (needs a Bearer flow on the API)
- [ ] Create-vehicle screen; photo caption edit/delete; fix deep-link parser; configurable API URL
- [ ] Mobile tests + CI; EAS build profiles

## P5 - Production
- [ ] Multi-stage production Dockerfile (`next build` / `next start`, `prisma migrate deploy`)
- [ ] Secrets out of compose, pinned image versions, private bucket + signed read URLs or CDN
- [ ] Move rate limiter store to Redis for multi-instance deploys
- [ ] Nonce-based CSP with `script-src`
- [ ] Logging, error tracking, health endpoint, DB backups, deploy pipeline

## Known environment notes
- Windows: run `npm test` from an uppercase-drive path (`D:\...`); lowercase `d:` breaks vitest.
- A native PostgreSQL on 5432 conflicts with Docker; set `DB_PORT=5433` in the root `.env`.
- `next dev` can crash with EPERM on a stale `.next`; delete `.next` first.
