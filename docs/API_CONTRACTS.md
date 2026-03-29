# Cars-Of-Ceylon: API Contracts

This document defines the API contracts that both **web** and **mobile** implementations must follow. These contracts are the source of truth for cross-platform consistency.

## Overview

- **Backend**: Next.js App Router API routes (server-side validation with Zod)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Auth.js (NextAuth) with JWT sessions
- **Shared Contracts**: Located in `web/src/lib/contracts/`

All API responses follow a consistent error format:

```json
{
  "error": "Human-readable error message",
  "details": {
    "field": ["Validation error for field"]
  }
}
```

---

## Authorization Model

All mutation endpoints (POST, PATCH, DELETE) enforce permission checks. Actors are classified as:

- **Owner**: User who created the resource (Vehicle, Report)
- **Moderator**: User with `role === "MODERATOR"`
- **Admin**: User with `role === "ADMIN"`

Policy: **Owner OR Moderator OR Admin** can perform protected actions.

User Roles (from database):
```
enum UserRole {
  USER      // Regular user (no moderation rights)
  MODERATOR // Can review and resolve reports
  ADMIN     // Can perform all moderation actions
}
```

---

## Shared Contract Files

All request/response shapes are defined in TypeScript + Zod:

### `web/src/lib/contracts/vehicle-contracts.ts`

Export Vehicle-related schemas and types for vehicle CRUD operations.

**Example Schemas:**
- `createVehicleRequestSchema`: Validates POST /api/vehicles body
- `updateVehicleRequestSchema`: Validates PATCH /api/vehicles/:id body
- `vehicleResponseSchema`: Shape of successful vehicle responses

### `web/src/lib/contracts/report-contracts.ts`

Export Report-related schemas for user reports and moderation workflows.

**Example Schemas:**
- `createReportRequestSchema`: Validates POST /api/reports body
- `updateReportStatusRequestSchema`: Validates PATCH /api/reports/:id body
- `listReportsQuerySchema`: Validates GET /api/reports query parameters
- `reportStatusSchema`: Enum of `PENDING | REVIEWING | RESOLVED | REJECTED`

### `web/src/lib/contracts/api-contracts.ts`

Export shared error contract and common response shapes.

---

## Authentication

### Session Structure

Once authenticated, the user session is available server-side and includes:

```typescript
interface Session {
  user: {
    id: string;              // User ID (UUID)
    email: string;           // User email
    name?: string;           // User name
    role: "USER" | "MODERATOR" | "ADMIN";  // User role
  };
  expires: string;           // ISO timestamp
}
```

**Mobile Note**: Sessions are JWT-based and stored in secure cookies for web. For React Native, use Authorization header:
```
Authorization: Bearer <token>
```

---

## Vehicle Endpoints

### Create Vehicle

```
POST /api/vehicles
Content-Type: application/json
Authorization: Required (User role)
```

**Request Body** (from `createVehicleRequestSchema`):
```json
{
  "uniqueIdentifier": "string (required, 1+ chars, globally unique)",
  "licensePlate": "string or null (globally unique if provided)",
  "manufacturer": "string (required)",
  "model": "string (required)",
  "year": "number (required, 1886–2100)",
  "description": "string or null",
  "visibility": "PUBLIC | PRIVATE (default: PUBLIC)"
}
```

**Response (201 Created)**:
```json
{
  "id": "string (uuid)",
  "uniqueIdentifier": "string",
  "licensePlate": "string or null",
  "manufacturer": "string",
  "model": "string",
  "year": "number",
  "description": "string or null",
  "visibility": "PUBLIC | PRIVATE",
  "createdBy": {
    "id": "string",
    "name": "string or null",
    "email": "string"
  },
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

**Error Cases**:
- `400`: Missing required fields or validation failure
- `409 Conflict`: `uniqueIdentifier` or `licensePlate` already exists
- `401 Unauthorized`: Not authenticated

---

### Get Vehicle Detail

```
GET /api/vehicles/:id
Authorization: Optional (Permissions enforced)
```

**Response (200 OK)**:
```json
{
  "id": "string",
  "uniqueIdentifier": "string",
  "licensePlate": "string or null",
  "manufacturer": "string",
  "model": "string",
  "year": "number",
  "description": "string or null",
  "visibility": "PUBLIC | PRIVATE",
  "createdBy": {
    "id": "string",
    "name": "string or null",
    "email": "string"
  },
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime",
  "events": [
    {
      "id": "string",
      "type": "string",
      "title": "string",
      "date": "ISO datetime",
      "description": "string or null"
    }
  ],
  "photos": [
    {
      "id": "string",
      "url": "string (MinIO S3 URL)",
      "caption": "string or null",
      "uploaderName": "string",
      "uploadedAt": "ISO datetime"
    }
  ]
}
```

**Error Cases**:
- `404 Not Found`: Vehicle not found OR visibility is PRIVATE and caller is not owner
- `500 Internal Server Error`: Database error

---

### Update Vehicle

```
PATCH /api/vehicles/:id
Content-Type: application/json
Authorization: Required (Owner | Moderator | Admin)
```

**Request Body** (from `updateVehicleRequestSchema`, all fields optional):
```json
{
  "uniqueIdentifier": "string (optional)",
  "licensePlate": "string or null (optional)",
  "manufacturer": "string (optional)",
  "model": "string (optional)",
  "year": "number (optional)",
  "description": "string or null (optional)",
  "visibility": "PUBLIC | PRIVATE (optional)"
}
```

**Response (200 OK)**: Same vehicle shape as GET /api/vehicles/:id

**Error Cases**:
- `400`: Validation failure
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not owner, moderator, or admin
- `404 Not Found`: Vehicle not found
- `409 Conflict`: Duplicate `uniqueIdentifier` or `licensePlate`

---

### Delete Vehicle

```
DELETE /api/vehicles/:id
Authorization: Required (Owner | Moderator | Admin)
```

**Response (204 No Content)**: Empty body

**Error Cases**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not owner, moderator, or admin
- `404 Not Found`: Vehicle not found
- `500 Internal Server Error`: Database error during cascade delete

---

## Report Endpoints

### Create Report

```
POST /api/reports
Content-Type: application/json
Authorization: Required (User role)
```

**Request Body** (from `createReportRequestSchema`):
```json
{
  "vehicleId": "string (uuid, must exist)",
  "reason": "string (required, 5–2000 chars)"
}
```

**Response (201 Created)**:
```json
{
  "id": "string (uuid)",
  "vehicleId": "string",
  "creatorId": "string",
  "vehicle": {
    "uniqueIdentifier": "string",
    "licensePlate": "string or null"
  },
  "creator": {
    "id": "string",
    "email": "string",
    "name": "string or null"
  },
  "reason": "string",
  "status": "PENDING",
  "moderatedBy": null,
  "moderator": null,
  "createdAt": "ISO datetime",
  "moderatedAt": null
}
```

**Error Cases**:
- `400`: Missing/invalid fields or validation failure
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Vehicle does not exist

---

### List Reports (Moderator Queue)

```
GET /api/reports?status=PENDING&page=1&pageSize=10
Authorization: Required (Moderator | Admin role)
```

**Query Parameters** (from `listReportsQuerySchema`):
- `status`: Optional, one of `PENDING | REVIEWING | RESOLVED | REJECTED`
- `page`: Optional, minimum 1 (default: 1)
- `pageSize`: Optional, 1–50 (default: 10)

**Response (200 OK)**:
```json
{
  "items": [
    {
      "id": "string",
      "vehicleId": "string",
      "vehicle": {
        "uniqueIdentifier": "string",
        "licensePlate": "string or null",
        "manufacturer": "string",
        "model": "string"
      },
      "creator": {
        "id": "string",
        "email": "string",
        "name": "string or null"
      },
      "reason": "string",
      "status": "PENDING | REVIEWING | RESOLVED | REJECTED",
      "moderator": null | { "id": "string", "email": "string", "name": "string or null" },
      "createdAt": "ISO datetime",
      "moderatedAt": "ISO datetime or null"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5
}
```

**Error Cases**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: User role is not Moderator or Admin
- `400`: Invalid query parameters

---

### Update Report Status

```
PATCH /api/reports/:id
Content-Type: application/json
Authorization: Required (Moderator | Admin role)
```

**Request Body** (from `updateReportStatusRequestSchema`):
```json
{
  "status": "REVIEWING | RESOLVED | REJECTED (required)"
}
```

Note: Status transitions to `PENDING` are invalid; reports start in `PENDING`.

**Response (200 OK)**:
```json
{
  "id": "string",
  "vehicleId": "string",
  "vehicle": {
    "uniqueIdentifier": "string",
    "licensePlate": "string or null"
  },
  "creator": {
    "id": "string",
    "email": "string",
    "name": "string or null"
  },
  "reason": "string",
  "status": "REVIEWING | RESOLVED | REJECTED",
  "moderator": {
    "id": "string",
    "email": "string",
    "name": "string or null"
  },
  "createdAt": "ISO datetime",
  "moderatedAt": "ISO datetime"
}
```

**Error Cases**:
- `400`: Invalid or missing `status`
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: User role is not Moderator or Admin
- `404 Not Found`: Report does not exist

---

## Authentication Endpoints

### Register

```
POST /api/auth/register (if implemented)
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "string (required, valid email)",
  "password": "string (required, 8+ chars)",
  "name": "string (optional)"
}
```

**Response (201 Created)**: User object with session token (mobile) or cookie (web)

---

### Login

```
POST /api/auth/signin (NextAuth endpoint)
Content-Type: application/x-www-form-urlencoded
```

**Request Body**:
```
email=user@example.com&password=secretpassword
```

**Response**: JWT token in Authorization header (mobile) or secure cookie (web)

---

### Get Current Session

```
GET /api/auth/session
Authorization: Optional
```

**Response (200 OK)**:
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string or null",
    "role": "USER | MODERATOR | ADMIN"
  },
  "expires": "ISO datetime"
}
```

---

## Mobile Implementation Guidelines

### Token Handling

1. **Login Flow**: POST to `/api/auth/signin` with credentials
2. **Token Storage**: Store JWT token securely (e.g., React Native SecureStore)
3. **Request Headers**: Add `Authorization: Bearer <token>` to all requests
4. **Token Refresh**: Implement refresh token rotation if token expires

### Error Handling

All error responses follow this structure:
```json
{
  "error": "Human-readable message",
  "details": {
    "field1": ["Error for field1"],
    "field2": ["Error for field2"]
  }
}
```

Use `details` to populate form-level validation errors.

### Pagination

Implement cursor-based or offset-based pagination per endpoint spec:
- **Offset**: `page` and `pageSize` (used in GET /api/reports)
- Parse `totalPages` from response to know when to disable "Next" button

### Optimistic UI

For vehicle updates and report status changes, consider:
1. **Optimistic update**: Update local state immediately
2. **API call**: Send PATCH/POST in background
3. **Revert on error**: Restore previous state if API fails

### Shared Contracts

Mobile should **mirror** the Zod schemas from `web/src/lib/contracts/` using equivalent TypeScript types:

**Example** (web):
```typescript
export const createVehicleRequestSchema = z.object({
  uniqueIdentifier: z.string().min(1),
  licensePlate: z.string().nullable(),
  manufacturer: z.string(),
  model: z.string(),
  year: z.number(),
  description: z.string().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});
```

**Mobile equivalent** (TypeScript interface):
```typescript
interface CreateVehicleRequest {
  uniqueIdentifier: string;
  licensePlate: string | null;
  manufacturer: string;
  model: string;
  year: number;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
}
```

---

## HTTP Status Codes

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| 200  | OK | Successful GET or PATCH |
| 201  | Created | Successful POST |
| 204  | No Content | Successful DELETE |
| 400  | Bad Request | Validation error, missing required fields |
| 401  | Unauthorized | Missing or invalid authentication |
| 403  | Forbidden | User lacks permission (not owner/mod/admin) |
| 404  | Not Found | Resource does not exist |
| 409  | Conflict | Unique constraint violation (duplicate identifier/plate) |
| 500  | Internal Server Error | Unhandled backend error |

---

## Timeline & Feature Parity

### Phase 1: Core Flows (MVP Parity with Web)
- ✅ Vehicle CRUD (Create, Read, Update, Delete)
- ✅ User authentication (Login, Register, Session)
- ✅ User vehicle listing (browse/search)
- ✅ Vehicle detail with timeline and photos
- ✅ User report submission
- ✅ Moderator queue and status update (if moderator role)

### Phase 2: Advanced Features (Post-MVP)
- ( ) Vehicle photo upload (MinIO integration)
- ( ) Timeline event creation
- ( ) Advanced search and filtering
- ( ) User profile and vehicle history
- ( ) Push notifications for report updates

---

## Testing Mobile Against API

### Quick Validation Checklist

1. **Create Vehicle**: POST /api/vehicles with valid payload → 201 with id
2. **Get Vehicle**: GET /api/vehicles/:id → 200 with full detail
3. **Update Vehicle**: PATCH /api/vehicles/:id with new data → 200
4. **Delete Vehicle**: DELETE /api/vehicles/:id → 204
5. **Create Report**: POST /api/reports → 201
6. **List Reports** (as moderator): GET /api/reports → 200 with items
7. **Update Report** (as moderator): PATCH /api/reports/:id → 200
8. **Auth**: Login flow → JWT token stored and used in subsequent requests
9. **Permission Checks**: Try PATCH/DELETE as non-owner → 403 Forbidden
10. **Validation**: POST with invalid data → 400 with details

---

## Notes

- All datetime fields are ISO 8601 format (UTC)
- UUIDs are returned as strings
- Nullable fields may be `null` or omitted depending on client preference
- Rate limiting not yet implemented; add if needed for production
- CORS is configured for web only; mobile uses direct token auth
