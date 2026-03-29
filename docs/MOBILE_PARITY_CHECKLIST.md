# Mobile Parity Checklist

This checklist ensures the React Native + Expo mobile app maintains feature and API parity with the web implementation. Update items as features are completed.

## Phase 1: Core MVP (Required for Launch)

### Authentication & User Management

- [ ] User can create account (POST /api/auth/register if available, or OAuth)
- [ ] User can log in with email/password (POST /api/auth/signin)
- [ ] User session persists across app restarts (JWT stored securely)
- [ ] User can view current session (GET /api/auth/session)
- [ ] User can log out (clear stored token)
- [ ] User sees role-based UI (show/hide moderator features if role is MODERATOR/ADMIN)

### Vehicle Listing & Search

- [ ] User can view list of public vehicles (GET /api/vehicles with pagination)
- [ ] Vehicles are paginated (page/pageSize parameters work)
- [ ] User can search/filter vehicles by manufacturer/model (if backend supports)
- [ ] User can sort vehicles by date or name (if backend supports)
- [ ] Vehicles show owner information (name, email)
- [ ] User's own PRIVATE vehicles appear in their list

### Vehicle Detail

- [ ] User can view vehicle detail page (GET /api/vehicles/:id)
- [ ] Vehicle detail shows all metadata: manufacturer, model, year, license plate, unique identifier
- [ ] Vehicle detail shows visibility status (PUBLIC or PRIVATE)
- [ ] Timeline events display in chronological order
- [ ] Photos display in grid/list with captions and uploader info
- [ ] Non-owners cannot view PRIVATE vehicles (404 error handled gracefully)

### Vehicle Management (Owner/Moderator/Admin Only)

- [ ] Vehicle owner can edit vehicle metadata (PATCH /api/vehicles/:id)
- [ ] Edit form validates data before submission (match web validation rules)
- [ ] Duplicate uniqueIdentifier/licensePlate errors trigger 409 and show user-friendly message
- [ ] Vehicle owner can delete vehicle (DELETE /api/vehicles/:id)
- [ ] Delete requires confirmation dialog with "DELETE" typed exactly
- [ ] Moderators/Admins can edit/delete any vehicle
- [ ] After edit/delete, UI updates/redirects correctly

### Vehicle Creation

- [ ] User can create new vehicle (POST /api/vehicles)
- [ ] Form validates all required fields before submission
- [ ] uniqueIdentifier must be globally unique (409 conflict handled)
- [ ] licensePlate must be globally unique if provided (409 conflict handled)
- [ ] Visibility defaults to PUBLIC
- [ ] User can set vehicle to PRIVATE on creation
- [ ] After creation, user redirected to vehicle detail page
- [ ] Create form show field-level validation errors (required, min/max length, etc.)

### Report Submission

- [ ] User can submit report from vehicle detail page (POST /api/reports)
- [ ] Report form requires: vehicleId and reason (5–2000 chars)
- [ ] Report submission shows success message
- [ ] Report submission handles validation errors gracefully
- [ ] Only authenticated users can submit reports (401 if not logged in)

### Moderator Queue (Moderator/Admin Only)

- [ ] Moderator can view report queue (GET /api/reports, requires MODERATOR/ADMIN role)
- [ ] Moderator sees all reports or filtered by status (PENDING, REVIEWING, RESOLVED, REJECTED)
- [ ] Each report shows: vehicle info, reporter, reason, current status
- [ ] Moderator can filter reports by status (PENDING, REVIEWING, RESOLVED, REJECTED)
- [ ] Moderator can paginate through reports
- [ ] Moderator can transition report status (PATCH /api/reports/:id)
- [ ] Status transitions allowed: PENDING → REVIEWING, REVIEWING → RESOLVED, REVIEWING → REJECTED
- [ ] UI prevents invalid transitions (no PENDING → REJECTED directly)
- [ ] After status update, UI reflects new status and disables redundant buttons

### Navigation & Routing

- [ ] Home page lists vehicles and provides search
- [ ] Navigation includes: Home, Vehicle List, Add Vehicle
- [ ] Moderators/Admins see additional nav item: Moderation Queue
- [ ] User profile or settings page shows logged-in user info
- [ ] Deep links work: mobile://vehicles/:id opens vehicle detail

---

## Phase 2: Advanced Features (Post-MVP)

### Photo Management

- [ ] User can upload photos to vehicle (POST /api/vehicles/:id/photos if endpoint exists)
- [ ] Photos are stored in MinIO S3-compatible storage
- [ ] Photo upload shows progress indicator
- [ ] User can add photo captions
- [ ] User can delete photos they uploaded
- [ ] Photos display with alt-text and captions

### Timeline Events

- [ ] User can add timeline events to vehicle (POST /api/vehicles/:id/events if endpoint exists)
- [ ] Events show type, title, date, description
- [ ] Events sort chronologically
- [ ] User can edit their events
- [ ] User can delete their events

### Advanced Search

- [ ] Search by manufacturer
- [ ] Search by model
- [ ] Search by year range
- [ ] Search by license plate (if public)
- [ ] Search by unique identifier (if public)
- [ ] Filters work in combination

### Social Features (If applicable)

- [ ] User profile page shows user's vehicles and reports
- [ ] User can follow other users' vehicles (if Follow feature added)
- [ ] User receives notifications for report status updates
- [ ] User can view full history of their submissions

---

## API Contract Validation

### Request/Response Shape Matching

- [ ] All request payloads match `web/src/lib/contracts/*` schemas
  - [ ] Vehicle create/update payloads match `createVehicleRequestSchema` and `updateVehicleRequestSchema`
  - [ ] Report create/update payloads match `createReportRequestSchema` and `updateReportStatusRequestSchema`
  - [ ] All optional fields can be null or omitted

- [ ] All response shapes match contract expectations
  - [ ] Vehicle responses include all expected fields (id, uniqueIdentifier, manufacturer, model, year, visibility, createdBy, createdAt, updatedAt, events, photos)
  - [ ] Report responses include all fields (id, vehicleId, creator, reason, status, moderator, moderatedAt)
  - [ ] List responses include pagination info (total, page, pageSize, totalPages)

- [ ] Error responses follow standard format
  - [ ] `{ error: "message", details: { field1: ["error1"], field2: ["error2"] } }`
  - [ ] Form validation errors are extracted from `details` object

### Permission Model Consistency

- [ ] Owner can edit/delete their own vehicle (PATCH/DELETE succeed)
- [ ] Non-owner cannot edit/delete vehicle (403 Forbidden)
- [ ] Moderators can edit/delete any vehicle
- [ ] Admins can edit/delete any vehicle
- [ ] Only Moderator/Admin can view report queue
- [ ] Only Moderator/Admin can update report status
- [ ] Any authenticated user can submit report
- [ ] Non-authenticated users see 401 on protected routes

### HTTP Status Codes

- [ ] 200 OK: Successful GET and PATCH
- [ ] 201 Created: Successful POST
- [ ] 204 No Content: Successful DELETE
- [ ] 400 Bad Request: Validation failures show details
- [ ] 401 Unauthorized: Missing/invalid auth handled (redirect to login)
- [ ] 403 Forbidden: Permission denied shows user-friendly message
- [ ] 404 Not Found: Missing resources handled gracefully
- [ ] 409 Conflict: Duplicate identifier/plate errors show clear message
- [ ] 500 Internal Server Error: Generic error message to user, logging on backend

---

## UI/UX Consistency

### Visual Consistency

- [ ] Color scheme matches web (dark theme: zinc/neutral tones)
- [ ] Button styles match web (emerald for success, red for danger)
- [ ] Form inputs match web styling (border-zinc-700, bg-zinc-950)
- [ ] Typography hierarchy matches web (headings, body, labels)
- [ ] Spacing and padding consistent with web (mt-4, gap-3, p-6, etc.)

### Interaction Patterns

- [ ] Forms validate on blur/submit (match web behavior)
- [ ] Buttons show loading state while API call in progress
- [ ] Error messages appear inline on forms
- [ ] Success messages appear as toast or modal
- [ ] Confirmation dialogs used for destructive actions (delete)
- [ ] Delete confirmation requires typing "DELETE"

### Accessibility

- [ ] Form labels are associated with inputs
- [ ] Button text is descriptive (not just "OK" or "Cancel")
- [ ] Color is not sole indicator of status (use text/icons too)
- [ ] Touch targets are large enough (min 44x44 points)
- [ ] Images have alt-text
- [ ] Text has sufficient contrast

---

## Performance Targets

- [ ] Initial app load: < 3 seconds
- [ ] Vehicle list page: < 1 second after pagination
- [ ] Vehicle detail page with timeline/photos: < 2 seconds
- [ ] API request timeout: 30 seconds (configurable)
- [ ] Images are cached and reused (avoid re-fetching)
- [ ] Pagination implemented (not infinite scroll for v1)

---

## Testing Requirements

### Unit Tests

- [ ] Auth token stored/retrieved correctly
- [ ] Request/response parsing matches contracts
- [ ] Validation logic replicates web rules (uniqueIdentifier format, year range, etc.)
- [ ] Permission checks work (owner/mod/admin)

### Integration Tests

- [ ] Full flow: Create account → Create vehicle → View vehicle → Delete vehicle
- [ ] Full flow: Create vehicle → Submit report → (as moderator) View queue → Update status
- [ ] Permission denied: Logged-in non-owner tries to edit another's vehicle → 403
- [ ] Session persists: App killed and reopened → user still logged in

### Manual QA

- [ ] Test on iOS device/simulator
- [ ] Test on Android device/emulator
- [ ] Test offline behavior (show cached data or graceful error)
- [ ] Test with slow network (show loading states)
- [ ] Test with various screen sizes and orientations

---

## Tracking

| Feature | Status | Owner | Target Date |
|---------|--------|-------|-------------|
| Auth (Login/Register) | Not Started | TBD | |
| Vehicle CRUD | Not Started | TBD | |
| Vehicle Listing | Not Started | TBD | |
| Vehicle Detail | Not Started | TBD | |
| Report Submission | Not Started | TBD | |
| Moderator Queue | Not Started | TBD | |
| Photo Management | Not Started | TBD | |
| Timeline Events | Not Started | TBD | |

---

## Notes

- Refer to `docs/API_CONTRACTS.md` for exact endpoint specifications
- Refer to web implementation at `web/` directory for UI patterns
- Use shared contract types from `web/src/lib/contracts/` as TypeScript references
- Test against staging/dev backend before production release
- Keep mobile-only UI extensions to a minimum; prioritize API-driven behavior
