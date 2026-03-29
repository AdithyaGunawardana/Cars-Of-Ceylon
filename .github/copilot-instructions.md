# Cars-Of-Ceylon

## Project Overview

Vehicle history archive website where users store and explore car history.
The project follows a web-first strategy while developing a mobile app in parallel.

Each vehicle entry contains:

-   Manufacturer
-   Model
-   Year
-   License Plate
-   Description
-   Photos and more.

More details can be added later.

Registered users can add vehicles.

## Technology Stack

-   Next.js (React + TypeScript)
-   Tailwind CSS
-   Prisma ORM
-   PostgreSQL
-   Docker Compose for local app + DB
-   Auth.js (NextAuth)

## Delivery Strategy

-   Web is the source of truth for product behavior and backend contracts.
-   Mobile is developed alongside web, but only on API flows already stable on web.
-   Build features in this sequence: API contract -> web implementation -> mobile implementation -> shared validation.
-   Keep all business logic and validation on the server; avoid platform-specific logic drift.
-   Use feature flags for unfinished cross-platform features.

## Mobile Plan (Parallel)

-   Mobile stack target: React Native + Expo.
-   Reuse backend APIs from web; no direct DB logic in mobile.
-   Keep mobile in MVP parity with core flows: auth, browse/search, vehicle detail, create vehicle, timeline, photos.
-   Defer mobile-only polish until web parity and API stability are complete.

## Rules

-   License plate unique
-   Keep a `uniqueIdentifier` per vehicle (required)
-   Hash passwords
-   Simple code
-   Reusable and modular components

## Implementation Notes

-   App source is in `web/`
-   Future mobile source should be in `mobile/` (when scaffolded)
-   Use Prisma migrations for schema changes
-   Build API routes under Next.js App Router (`src/app/api/...`)
-   Favor server-side validation with Zod on write endpoints
-   Keep moderation and auditability in mind for user-generated content
-   Keep API responses consistent and version-friendly for web and mobile clients
-   Prefer ticket acceptance criteria that include API contract, permissions, and error handling

## When Generating Code
Always:
-   Ask permission before adding new features or generating code
-   Use comments to clarify purpose
-   Explain what the code does (briefly)