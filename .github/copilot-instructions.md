# Cars-Of-Ceylon

## Project Overview

Vehicle history archive website where users store and explore car history.

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

## Rules

-   License plate unique
-   Keep a `uniqueIdentifier` per vehicle (required)
-   Hash passwords
-   Simple code
-   Reusable components

## Implementation Notes

-   App source is in `web/`
-   Use Prisma migrations for schema changes
-   Build API routes under Next.js App Router (`src/app/api/...`)
-   Favor server-side validation with Zod on write endpoints
-   Keep moderation and auditability in mind for user-generated content
