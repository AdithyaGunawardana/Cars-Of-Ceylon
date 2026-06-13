# Sprint 6 Checklist

## Scope

- Mobile parity for core vehicle workflows
- Mobile parity for timeline, photos, and moderation flows
- User profile and follow relationship features
- Search, filtering, and discovery improvements
- Production readiness and release hardening

## API Acceptance

- [ ] Mobile can authenticate and reuse session state across app restarts
- [ ] Mobile can create, update, and delete vehicles via shared API contracts
- [ ] Mobile can create, edit, and delete timeline events via shared API contracts
- [ ] Mobile can upload photos, retry uploads, and finalize photo metadata via shared API contracts
- [ ] Mobile can submit reports and view moderator queue when role permits
- [ ] User profile and follow APIs are available for mobile consumption
- [ ] Search/filter endpoints support mobile discovery use cases

## Mobile Acceptance

- [ ] Login flow persists and clears auth state correctly
- [ ] Vehicle list supports search/filter/pagination controls
- [ ] Vehicle detail supports full CRUD for owner/moderator/admin actions
- [ ] Timeline UI supports add/edit/delete for authorized users
- [ ] Photo UI supports upload progress, retry, cancel, and caption management
- [ ] Report submission and moderation queue screens are fully usable on mobile
- [ ] Profile screen shows user summary, vehicles, and follow state
- [ ] Deep links navigate directly to vehicle and profile screens

## Web Acceptance

- [ ] Web and mobile share the same response/error contracts for the new flows
- [ ] Web pages remain source of truth for validation and permission rules
- [ ] Any new UI polish on web is mirrored only after API behavior is stable

## Test Acceptance

- [ ] Mobile-facing API contract tests cover auth, CRUD, moderation, and discovery flows
- [ ] End-to-end tests cover mobile-equivalent vehicle create/update/delete flows
- [ ] End-to-end tests cover mobile-equivalent report and moderation queue flows
- [ ] Shared validation tests cover request/response parity between web and mobile expectations

## Verification Commands

```bash
cd web
npm run lint
npm run test
npm run build
```

## Notes

- Sprint 6 should move the mobile app from bootstrap to feature parity on the most important flows.
- Keep the web app as the canonical source of behavior, and let mobile follow the same contracts.
- Add platform-specific polish only after the shared API and behavior are stable.
