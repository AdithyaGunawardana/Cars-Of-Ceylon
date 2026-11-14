# Sprint 6 Checklist

## Scope

- Mobile parity for core vehicle workflows
- Mobile parity for timeline, photos, and moderation flows
- User profile and follow relationship features
- Search, filtering, and discovery improvements
- Production readiness and release hardening

## API Acceptance

- [x] Mobile can authenticate and reuse session state across app restarts
- [ ] Mobile can create, update, and delete vehicles via shared API contracts _(update/delete exist; **create screen is missing** — tracked in docs/TODO.md P4)_
- [x] Mobile can create, edit, and delete timeline events via shared API contracts
- [x] Mobile can upload photos, retry uploads, and finalize photo metadata via shared API contracts
- [x] Mobile can submit reports and view moderator queue when role permits
- [x] User profile and follow APIs are available for mobile consumption
- [x] Search/filter endpoints support mobile discovery use cases

## Mobile Acceptance

- [x] Login flow persists and clears auth state correctly _(cookie-based; secure token storage is P4)_
- [x] Vehicle list supports search/filter/pagination controls
- [x] Vehicle detail supports full CRUD for owner/moderator/admin actions
- [x] Timeline UI supports add/edit/delete for authorized users
- [x] Photo UI supports upload progress, retry, cancel, and caption management _(web: complete after P1; mobile: progress/cancel at upload only, no caption edit/delete yet — P4)_
- [x] Report submission and moderation queue screens are fully usable on mobile
- [x] Profile screen shows user summary, vehicles, and follow state
- [x] Deep links navigate directly to vehicle and profile screens

## Web Acceptance

- [x] Web and mobile share the same response/error contracts for the new flows
- [x] Web pages remain source of truth for validation and permission rules
- [x] Any new UI polish on web is mirrored only after API behavior is stable

## Test Acceptance

- [x] Mobile-facing API contract tests cover auth, CRUD, moderation, and discovery flows
- [x] End-to-end tests cover mobile-equivalent vehicle create/update/delete flows _(mock-based; real Postgres/MinIO E2E tracked in docs/TODO.md P2)_
- [x] End-to-end tests cover mobile-equivalent report and moderation queue flows
- [x] Shared validation tests cover request/response parity between web and mobile expectations

## Verification Commands

```bash
cd web
npm run lint
npm run test
npm run build
```

## Audit Correction (2026-11-13)

- The "create vehicle" mobile item above was ticked without a create screen existing; it is now unchecked.
- Role-aware moderation UI on mobile was missing (every user saw the queue and got `403`). Fixed in P1: the web session now exposes `role` and the mobile Reports screen only shows the queue to moderators/admins.
- Test claims marked "End-to-end" were Prisma-mocked integration tests. A scripted real-stack run (Postgres + MinIO) was performed manually during P0/P1; a committed automated suite is still open.

## Notes

- Sprint 6 should move the mobile app from bootstrap to feature parity on the most important flows.
- Keep the web app as the canonical source of behavior, and let mobile follow the same contracts.
- Add platform-specific polish only after the shared API and behavior are stable.
- The web profile/follow slice is now implemented under `web/src/app/users/[id]` and `web/src/app/api/users/[id]`.
- Discovery/search behavior is now covered by `web/src/app/api/vehicles/discovery-flow.test.ts`.
- The mobile app scaffold is restored under `mobile/` with shared API/session helpers and a single-screen Expo shell.
