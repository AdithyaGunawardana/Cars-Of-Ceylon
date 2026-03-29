# Sprint 3 Checklist

## Scope

- Signed image upload initialization endpoint
- Direct-to-storage object upload flow in UI
- Photo metadata finalization endpoint
- Upload constraints and storage configuration docs

## API Acceptance

- [x] `POST /api/vehicles/:id/photos/upload-url` requires authentication
- [x] Upload URL route validates type and size limits
- [x] Upload URL route enforces owner/moderator/admin permissions
- [x] `POST /api/vehicles/:id/photos/finalize` finalizes metadata using `storageKey`
- [x] Both endpoints return clear 4xx/5xx errors for invalid or missing storage config

## Web Acceptance

- [x] Vehicle detail photo form uses file upload input (not raw URL)
- [x] UI requests signed upload URL and uploads object with `PUT`
- [x] UI calls finalize photo endpoint after successful upload
- [x] Upload errors are shown with user-friendly messages

## Verification Commands

```bash
cd web
npm run lint
npm run build
```

## Notes

- Storage credentials and endpoint are required for upload routes.
- Current limits: JPEG/PNG/WebP, max 10 MB.
- This sprint enables backend-safe uploads for both web and future mobile clients.
