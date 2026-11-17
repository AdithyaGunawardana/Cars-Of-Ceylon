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

## P3 - Features needed to call it complete (DONE in code and verified locally; real-service checks below)
- [x] Profile editing (name, bio, avatar upload or link), account settings, change password
- [x] Password reset (emailed single-use hashed token, 1h, rate limited, no account enumeration, signs out older sessions) and email verification (24h token, confirm is a POST so scanners cannot burn it)
- [x] Vehicle soft delete + restore (`/account/vehicles`), moderation audit log (`/moderation/log`), orphaned S3 object cleanup (photos and avatars) and 30-day purge (`npm run storage:cleanup`)
- [x] Moderation actions: hide/unhide vehicle, photo, event (buttons in the UI); ban/unban user (immediate, DB-checked, blocks login)
- [x] Discovery: ranked full-text search (`q`, includes timeline text, partial words), sorting, year range, follow feed (`/feed`, `GET /api/feed`)
- [x] `attributes` JSON: validated schema (colour, fuel, transmission, body type, engine cc, odometer) used by the create/edit forms, detail page and list filters
- [x] SEO: `generateMetadata` for vehicles and profiles (non-public records are `noindex` and never described), `sitemap.xml`, `robots.txt`, Open Graph images (site and per vehicle); `error.tsx`, `not-found.tsx`, `loading.tsx` (list page only, see note)
- [x] S3/R2 CORS: `npm run storage:cors` builds and applies the rule (wildcards refused); documented in `web/README.md`
- [x] Real landing page with live statistics; one UI theme everywhere (moderation pages and forms migrated off zinc/amber)
- [x] Browser E2E for the new UI (`tests/e2e/moderation-discovery.spec.ts`)

Verified on 2026-11-17 against local stand-ins (all green):
- **Email over real SMTP** (Mailpit): registration sends the verification mail, confirm works once, forgot-password gives an identical answer for known and unknown addresses, the reset mail arrives, the token works once, the old password stops working and the new one signs in; `From` uses `MAIL_FROM` and links use `AUTH_URL`. 12/12 checks.
- **Bucket CORS** (SeaweedFS, which implements per-bucket CORS unlike MinIO): `npm run storage:cors` applies and reads back the rule; browser-style preflights pass from allowed origins and get 403 from others. This found a real bug, now fixed: the SDK's default checksum setting put an empty-body CRC32 into presigned PUT URLs, which AWS S3 / R2 reject (local MinIO ignores it). Regression test in `src/lib/storage.test.ts`.
- **Cleanup job** (`npm run storage:cleanup`, end to end): dry run changes nothing; `--apply` removes an abandoned upload and a vehicle soft-deleted 40 days ago (its photo object and row) while live data and a referenced avatar survive.

Still to do against real services (cannot be done without accounts, a domain and a host):
- [ ] **Email provider**: choose one (Brevo, Resend, SES, Mailgun, Postmark; Mailtrap for a staging inbox), verify the sending domain (SPF, DKIM, DMARC), set `SMTP_URL` + `MAIL_FROM`, and send a real registration and reset email to a real inbox (check it is not spam).
- [ ] **Real bucket** (S3 or Cloudflare R2): create it, set `UPLOAD_S3_*` including `UPLOAD_S3_PUBLIC_BASE_URL`, run `UPLOAD_CORS_ORIGINS=https://your-site npm run storage:cors`, then upload a vehicle photo and an avatar from the deployed site in a browser. If the provider rejects the `x-amz-*` header wildcard in the rule, set the CORS rule in its dashboard (origin, methods PUT/GET/HEAD, headers Content-Type, Content-Length).
- [ ] **Schedule** `npm run storage:cleanup -- --apply` daily where the app runs (cron, Task Scheduler or a platform cron job). Run it without `--apply` first and read the report. GitHub Actions cannot do this yet: scheduled workflows only run from the default branch (`main`).
- [ ] First deploy: `npx prisma migrate deploy` (migrations `20261114000001` and `20261114000002` are pending on any database created before P3), `AUTH_SECRET`, an `https` `AUTH_URL`, `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`.

Design notes and known limits:
- `loading.tsx` exists only for the vehicle list (route group `vehicles/(list)`). A `loading.tsx` above a page that can call `notFound()` makes Next stream a 200 first, which turns missing or hidden vehicles into soft 404s.
- Email verification does not gate any feature yet (existing accounts are unverified); the account page shows a notice and a resend button.
- Changing your password while signed in does not sign out your other sessions (a password *reset* does).
- A soft-deleted vehicle keeps its unique identifier and plate until purged, so re-adding the same plate gives 409 for up to 30 days.
- Full-text search matches with ILIKE as well as `tsvector`, so it scans the public vehicle table; fine for thousands of rows, add a GIN index/materialized document before it reaches hundreds of thousands.

## P4 - Mobile
- [x] Upgrade to Expo SDK 58 (RN 0.88, React 19.3, TS 6), tsconfig extends `expo/tsconfig.base`, ESLint 9 flat config (`eslint-config-expo`), `typecheck` script; verified with `expo-doctor` (20/20), `expo install --check`, and real Android + iOS Metro bundles. Three moderate audit findings remain in Expo build tooling (`@expo/fingerprint` / `minimatch`, no non-breaking fix; they do not ship in the app)
  - **Expo Go caveat:** Expo Go supports exactly one SDK. SDK 58 shipped 2026-10-15 and its store release of Expo Go was announced as "within a few weeks"; confirm the Expo Go on your phone supports SDK 58 (it shows the supported SDK on its home screen), otherwise use a development build (`expo-dev-client` + EAS Build)
- [x] Split `App.tsx` into Expo Router screens (`src/app`: sign-in, tabs, vehicle, user; auth via `Stack.Protected`; deep links `carsceylon://vehicles/<id>`, `carsceylon://users/<id>`)
- [ ] Token-based auth in `expo-secure-store` (needs a Bearer flow on the API)
- [ ] Create-vehicle screen; photo caption edit/delete; fix deep-link parser; configurable API URL
- [ ] Mobile tests + CI; EAS build profiles

## P5 - Production
- [ ] **Decide the hosting target and buy a domain first** (needed by email DNS records, the bucket's public URL and CORS origin, and `AUTH_URL`). The Dockerfile, rate-limit store, secrets and CSP choices all depend on the host. Candidates: a PaaS with managed Postgres (Railway, Render, Fly.io), Vercel plus a managed Postgres, or a VPS with Docker Compose.
- [ ] **Stand up a free-tier staging deploy early** (before the rest of P5) to catch host-specific problems, and use it for the real-service checks listed under P3.
- [ ] Make `storage:cleanup` runnable in the production image (the script runs through `tsx`, a dev dependency).
- [ ] Replace the frozen Bitnami legacy MinIO image used for local dev and CI (the upstream project is archived) with a maintained S3-compatible server.
- [ ] Multi-stage production Dockerfile (`next build` / `next start`, `prisma migrate deploy`)
- [ ] Secrets out of compose, pinned image versions, private bucket + signed read URLs or CDN
- [ ] Move rate limiter store to Redis for multi-instance deploys
- [ ] Nonce-based CSP with `script-src`
- [ ] Logging, error tracking, health endpoint, DB backups, deploy pipeline

## Known environment notes
- Windows: run `npm test` from an uppercase-drive path (`D:\...`); lowercase `d:` breaks vitest.
- A native PostgreSQL on 5432 conflicts with Docker; set `DB_PORT=5433` in the root `.env`.
- `next dev` can crash with EPERM on a stale `.next`; delete `.next` first.
