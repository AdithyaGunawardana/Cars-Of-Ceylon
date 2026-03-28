# Sprint 2 Checklist

## Scope

- Timeline event creation endpoint and UI flow
- Photo metadata creation endpoint and UI flow
- Login and register pages for web auth UX
- Permission checks for contribution actions

## API Acceptance

- [ ] `POST /api/vehicles/:id/events` requires authentication
- [ ] `POST /api/vehicles/:id/photos` requires authentication
- [ ] Event and photo creation are blocked for unauthorized contributors
- [ ] Validation errors return HTTP 400 with usable error payloads

## Web Acceptance

- [ ] Vehicle detail page includes event and photo contribution forms
- [ ] Signed-out users see clear sign-in guidance
- [ ] Non-owner/non-moderator users are blocked from contribution forms
- [ ] Login page signs in with credentials
- [ ] Register page creates account via API and redirects to login

## Verification Commands

```bash
cd web
npm run prisma:generate
npm run lint
npm run build
```

## Notes

- This sprint intentionally uses photo metadata input (URL + caption) before file upload pipeline hardening.
- Signed upload URL flow can be implemented in the next sprint.
