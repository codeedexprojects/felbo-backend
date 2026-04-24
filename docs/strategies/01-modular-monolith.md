# Strategy: Modular Monolith Structure

The codebase is a single deployable Node.js process organized as a modular monolith. Each feature domain lives in its own module under `src/modules/`. There is no microservice boundary, but modules have enforced internal structure.

---

## Directory Layout

```
src/
  modules/
    <module>/
      <module>.model.ts         — Mongoose schema + interface
      <module>.repository.ts    — Database operations only
      <module>.service.ts       — Business logic
      <module>.controller.ts    — Request parsing + response shaping
      <module>.types.ts         — Input/output DTOs and types
      <module>.validators.ts    — Zod schemas for request validation
      <module>.container.ts     — Manual dependency wiring
  routes/
    user/                       — User-facing route files
    vendor/                     — Vendor-facing route files
    barber/                     — Barber-facing route files
    admin/                      — Admin-facing route files
    public/                     — Unauthenticated routes
    webhook/                    — Razorpay webhook route
  shared/
    middleware/                 — authenticate, authorize, errorHandler, requestId
    services/                   — OTP, JWT, OTP session (cross-module)
    errors/                     — AppError subclasses
    database/                   — MongoDB connection, withTransaction
    redis/                      — Redis client
    queue/                      — BullMQ setup, Bull Board
    notification/               — FCM service, notification queue, notification worker
    config/                     — Config service, config keys
    utils/                      — time, rating, retry, idempotency, password, token
    logger/                     — Winston logger
  cron/
    statusHealer.ts             — Booking/slot status cleanup cron
    s3Cleanup.ts                — S3 orphan photo cleanup cron
```

---

## Layer Responsibilities

### Model

Defines the Mongoose schema and the TypeScript `I<Entity>` interface that describes a document. Nothing else.

### Repository

Pure database operations. Accepts optional `ClientSession` parameters so callers can include the operation in an external transaction. Never contains business logic or calls other services. Cross-module reads go through the owning module's service, not by importing a foreign repository directly.

### Service

All business logic lives here. Validates preconditions, orchestrates multiple repository calls, calls external services, handles transactions. Services communicate with each other through getter functions to avoid circular dependency issues (see [Dependency Injection](./02-dependency-injection.md)).

### Controller

Thin layer that:
1. Parses and validates the request using Zod `.parse()`.
2. Calls exactly one service method.
3. Returns the response.

Controllers have no try/catch — errors bubble up to the global `errorHandler` middleware.

### Validators

Zod schemas for request bodies and query parameters. Kept separate from types so the runtime validation schemas and the compile-time types are co-located but distinct.

### Container

Wires all dependencies manually and exports singleton instances of the service and controller. See [Dependency Injection](./02-dependency-injection.md).

### Types

Input types (what the service accepts), output DTOs (what the service returns), and internal types. Kept separate from validators and the Mongoose interface.

---

## Shared vs Module

`src/shared/` contains code that is genuinely cross-cutting:
- Infrastructure services (JWT, OTP, Redis, queue, FCM).
- Middleware used by all routes.
- Utility functions with no domain logic.
- Error class hierarchy.

Business logic that belongs to a specific domain always goes into that domain's module, even if multiple other modules call into it. The `BookingService`, for example, is called by `VendorService`, `IssueService`, and `AdminService` — but it lives in `src/modules/booking/` and is imported via DI.

---

## Route Organization

Routes are organized by actor, not by resource:
- `/api/v1/user/*` — actions a user can take.
- `/api/v1/vendor/*` — actions a vendor can take.
- `/api/v1/barber/*` — actions a barber can take.
- `/api/v1/admin/*` — actions an admin can take.
- `/api/v1/public/*` — unauthenticated (slot queries).
- `/api/v1/webhooks/*` — external callbacks (Razorpay).

The same underlying service method (e.g., fetching a shop) may be exposed on multiple actor routes with different access controls and response shapes.

---

## No Barrel Exports in Modules

Individual module files do not re-export via `index.ts`. Imports are always explicit:

```
import { BookingService } from '../booking/booking.service';
```

The only barrel export is `src/shared/errors/index.ts`, which re-exports all error classes for convenience.
