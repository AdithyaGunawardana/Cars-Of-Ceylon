# Sprint 5 Checklist

## Scope

- Timeline event edit/delete API endpoints and UI controls
- Photo upload UX resilience improvements (retry/cancel/status states)
- Moderation hardening (report rate limiting + audit visibility)
- Mobile app baseline scaffold for API parity work

## API Acceptance

- [x] `PATCH /api/vehicles/:id/events/:eventId` updates timeline event fields with owner/moderator/admin permissions
- [x] `DELETE /api/vehicles/:id/events/:eventId` deletes timeline events with owner/moderator/admin permissions
- [x] `POST /api/reports` enforces per-user rate limit (`5` reports per `15` minutes)
- [x] Rate-limit violations return HTTP `429` with clear error payload

## Web Acceptance

- [x] Vehicle detail timeline supports inline edit controls for authorized users
- [x] Vehicle detail timeline supports event delete controls for authorized users
- [x] Photo upload form provides staged status labels (prepare/upload/finalize)
- [x] Photo upload form supports canceling in-flight upload requests
- [x] Photo upload form supports retrying the last failed upload attempt
- [x] Moderation queue shows audit context including moderation actor and latest moderation timestamp

## Mobile Acceptance

- [x] `mobile/` scaffold created with Expo baseline config
- [x] Mobile baseline includes credential login screen and session marker storage
- [x] Mobile baseline includes vehicle list screen wired to web API contracts
- [x] Mobile baseline includes vehicle detail preview flow

## Test Acceptance

- [x] Timeline event route tests cover auth/permission/success for edit/delete endpoint
- [x] Timeline event lifecycle integration test covers create -> update -> delete flow
- [x] Report route tests cover rate-limit rejection (`429`) behavior
- [x] Photo upload URL tests include failed-attempt recovery path

## Verification Commands

```bash
cd web
npm run lint
npm run test
npm run build
```

## Notes

- Sprint 5 advances both web parity and mobile bootstrap without changing core domain contracts.
- Mobile scaffold is intentionally minimal and API-first so feature parity can be expanded incrementally.
- Shared API references for mobile implementation remain in `docs/API_CONTRACTS.md` and `docs/MOBILE_PARITY_CHECKLIST.md`.
