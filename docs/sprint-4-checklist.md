# Sprint 4 Checklist

## Scope

- Moderation report submission endpoint
- Moderator report queue endpoint
- Moderator report status update endpoint
- Web moderation queue interface and vehicle report form
- Vehicle metadata edit/delete UI on detail page

## API Acceptance

- [x] `POST /api/reports` requires authentication and validates report payload
- [x] Report creation returns 404 when vehicle is missing
- [x] `GET /api/reports` is restricted to moderator/admin roles
- [x] `PATCH /api/reports/:id` is restricted to moderator/admin roles
- [x] Report status updates track moderator identity
- [x] `PATCH /api/vehicles/:id` supports owner/moderator/admin vehicle updates
- [x] `DELETE /api/vehicles/:id` supports owner/moderator/admin vehicle deletion

## Web Acceptance

- [x] Vehicle detail includes a signed-in report submission form
- [x] `/moderation/reports` requires moderator/admin authorization
- [x] Moderation page lists reports with status and context
- [x] Moderators can transition status to reviewing/resolved/rejected
- [x] Moderation route is linked from primary navigation
- [x] Vehicle detail allows owner/moderator/admin to edit metadata
- [x] Vehicle detail allows owner/moderator/admin to delete vehicle

## Test Acceptance

- [x] Report route tests cover auth, validation, and success paths
- [x] Report update route tests cover auth, permission, not-found, and success
- [x] End-to-end moderation flow test (create report -> resolve) in integration environment
- [x] End-to-end moderation flow test (create report -> reject) in integration environment
- [x] Vehicle detail route tests cover GET privacy, PATCH permissions/conflicts, and DELETE permissions

## Verification Commands

```bash
cd web
npm run lint
npm run test
npm run build
```

## Notes

- Report contracts live in `web/src/lib/contracts/report-contracts.ts`.
- Shared API error contract is in `web/src/lib/contracts/api-contracts.ts`.
- Moderation queue page is currently available at `/moderation/reports`.
