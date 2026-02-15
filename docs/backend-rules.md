# Felbo — Backend Development Rules & System Context

**Version:** 1.0
**Last Updated:** February 2025
**Purpose:** This document defines the mandatory rules, patterns, and conventions for the Felbo backend. Every developer and LLM assisting with this codebase MUST follow these rules. No exceptions.

---

## 1. Project Identity

Felbo is a same-day haircut booking platform for Kerala barbershops. Users discover nearby salons, book appointments, pay ₹10 advance online, and pay the remaining amount at the shop.

**Tech Stack:** Node.js / Express / TypeScript / MongoDB (Mongoose) / Redis / Bull queues
**Architecture:** Modular Monolith with vertical feature modules
**Deployment:** 2-3 Node.js instances behind a load balancer on AWS

---

## 2. Architecture Rules

### 2.1 Architecture Style

This project uses a **Modular Monolith** with a **Service Layer + Repository Pattern + Strict Dependency Discipline**.

This is NOT:

- Clean Architecture
- Domain-Driven Design (DDD)
- Microservices
- CQRS or Event Sourcing

### 2.2 Module Structure

Every feature module lives under `src/modules/` and contains exactly these files:

```
src/modules/<module_name>/
    ├── <module>.controller.ts    # HTTP layer
    ├── <module>.service.ts       # Business logic
    ├── <module>.repository.ts    # Data access
    ├── <module>.model.ts         # Mongoose schema
    ├── <module>.types.ts         # DTOs + domain types
    ├── <module>.validators.ts    # Zod schemas
    └── <module>.routes.ts        # Express route definitions
```

No additional files, no sub-folders within a module, no `index.ts` barrel exports.

### 2.3 Existing Modules

```
src/modules/
    ├── booking/
    ├── user/
    ├── vendor/
    ├── wallet/
    ├── payment/
    ├── review/
    ├── issue/
    ├── admin/
    ├── association/
    └── config/
```

If a new module is needed, discuss it before creating. Do not create modules casually.

### 2.4 Shared Folder Structure

```
src/shared/
    ├── database/
    │     ├── mongo.ts              # MongoDB connection
    │     └── transaction.ts        # withTransaction utility
    ├── redis/
    │     ├── redis.ts              # Redis connection
    │     └── lock.service.ts       # Distributed lock (slot locking)
    ├── queue/
    │     └── bull.ts               # Bull queue setup
    ├── middleware/
    │     ├── authenticate.ts       # JWT / session auth
    │     ├── authorize.ts          # Role-based access control
    │     └── errorHandler.ts       # Centralized error handler
    ├── errors/
    │     ├── AppError.ts           # Base error class
    │     ├── ValidationError.ts
    │     ├── ConflictError.ts
    │     ├── NotFoundError.ts
    │     └── UnauthorizedError.ts
    ├── config/
    │     └── config.service.ts     # Cached system config loader
    ├── utils/
    │     └── idempotency.ts        # Idempotency check for webhooks
    ├── constants/
    ├── types/
    └── logger/
          └── logger.ts             # Structured logging
```

---

## 3. Layer Responsibility Rules

These rules are absolute. Violating them creates unmaintainable code.

### 3.1 Controller (`*.controller.ts`)

**ALLOWED:**

- Validate input using Zod (call the validator)
- Call **one** service method
- Return the HTTP response (status code + body)
- Extract data from request (params, body, query, user)

**FORBIDDEN:**

- Any business logic whatsoever
- Direct database queries or repository calls
- Calling another module's controller
- Calling multiple service methods to orchestrate a flow
- Try/catch around service calls (the centralized error handler does this)

### 3.2 Service (`*.service.ts`)

**ALLOWED:**

- All business logic and orchestration
- Calling its own module's repository
- Calling other modules' **services** (never their repositories)
- Using `withTransaction` for multi-document operations
- Using Redis lock service for concurrency control
- Using the config service for system settings
- Throwing custom AppError subclasses
- Mapping Mongoose documents to DTOs before returning

**FORBIDDEN:**

- Direct Mongoose model access (use repository)
- Importing another module's repository
- Importing another module's model
- HTTP-related concerns (request/response objects, status codes)
- Returning raw Mongoose documents across module boundaries

### 3.3 Repository (`*.repository.ts`)

**ALLOWED:**

- Pure database operations (find, create, update, delete)
- Accepting a Mongoose `session` parameter for transactions
- Building queries, aggregation pipelines
- Returning raw Mongoose documents (to its own service only)

**FORBIDDEN:**

- Any business logic or validation
- Status checking or conditional logic beyond query filtering
- Calling other repositories
- Calling services
- Throwing business-level errors (throw only database-level errors)

### 3.4 Model (`*.model.ts`)

**ALLOWED:**

- Mongoose schema definition
- Indexes
- Virtual fields
- Pre/post hooks for data-level concerns only (timestamps, slugs)

**FORBIDDEN:**

- Business methods on the schema
- Static methods that contain business logic
- Importing services or repositories

### 3.5 Validators (`*.validators.ts`)

**ALLOWED:**

- Zod schemas for request input validation
- Input sanitization rules
- Custom Zod refinements for format checks

**FORBIDDEN:**

- Database lookups (existence checks belong in the service)
- Business rule validation

### 3.6 Types (`*.types.ts`)

**ALLOWED:**

- Input DTOs (what comes into the service)
- Output DTOs (what the service returns)
- Domain enums
- Shared type definitions for the module

**FORBIDDEN:**

- Mongoose-specific types (keep those in the model)
- Generic utility types (those go in `shared/types/`)

---

## 4. Module Interaction Rules

### 4.1 The One Rule

**Modules talk only through services. Never import another module's repository, model, or types directly.**

```typescript
// ✅ CORRECT
import { walletService } from '../wallet/wallet.service';

// ❌ WRONG — never do this
import { WalletModel } from '../wallet/wallet.model';
import { walletRepository } from '../wallet/wallet.repository';
```

### 4.2 Cross-Module Data

When Module A needs data from Module B:

- Module A calls Module B's service method
- Module B's service returns a DTO (not a Mongoose document)
- Module A never reaches into Module B's database

### 4.3 Shared Dependencies

Modules can freely import from `src/shared/`. That is the only exception to module isolation.

---

## 5. Type Safety Rules

### 5.1 TypeScript Configuration

- `strict: true` is mandatory
- No `any` types. Use `unknown` and narrow with type guards.
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why

### 5.2 Input/Output Types

Every service method must have:

- Explicitly typed input parameters (or an input DTO interface)
- An explicit return type

```typescript
// ✅ CORRECT
export interface CreateBookingInput {
  userId: string;
  shopId: string;
  barberId: string;
  services: string[];
  startTime: string;
}

export interface CreateBookingResult {
  bookingId: string;
  bookingNumber: string;
}

async createBooking(input: CreateBookingInput): Promise<CreateBookingResult> { ... }
```

### 5.3 Zod for Input Validation

All HTTP request input is validated with Zod in the controller before calling the service. No manual if-else validation.

```typescript
// In booking.validators.ts
export const createBookingSchema = z.object({
  shopId: z.string().min(1),
  barberId: z.string().min(1),
  services: z.array(z.string()).min(1),
  startTime: z.string(),
});

// In booking.controller.ts
const validated = createBookingSchema.parse(req.body);
const result = await bookingService.createBooking({
  ...validated,
  userId: req.user.id,
});
```

### 5.4 No Raw Mongoose Documents Across Module Boundaries

Within a module, services can work with Mongoose documents internally. But when returning data to a controller or to another module's service, always map to a plain DTO object.

---

## 6. Error Handling Rules

### 6.1 Custom Error Classes

Always throw custom error classes from services. Never throw raw `Error`.

```typescript
throw new ConflictError('This slot is already booked');
throw new ValidationError('Cancellation limit reached');
throw new NotFoundError('Booking not found');
throw new UnauthorizedError('You do not have permission');
```

### 6.2 Centralized Error Handler

A single `errorHandler` middleware in `shared/middleware/errorHandler.ts` catches all errors and returns a consistent JSON shape:

```typescript
{
  success: false,
  error: {
    code: "CONFLICT",
    message: "This slot is already booked"
  }
}
```

Controllers do NOT wrap service calls in try/catch. The middleware handles it.

### 6.3 Error Response Shape

Every API response follows this structure:

**Success:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

No other shapes. No inconsistency.

---

## 7. Critical System Rules

These are the high-risk areas that require strict implementation patterns.

### 7.1 Slot Locking (Double Booking Prevention)

- Slot locks are stored in **Redis**, NOT MongoDB
- Use `SET key value NX EX 300` (5-minute TTL, configurable)
- Lock key format: `slot-lock:{barberId}:{date}:{startTime}`
- Lock MUST be acquired before payment begins
- Lock MUST be released if payment fails
- Lock auto-expires via TTL as safety net

Never skip the lock step. Double bookings are a critical business failure.

### 7.2 Wallet Concurrency

- All wallet balance changes MUST use MongoDB transactions
- Read balance → validate → update MUST happen atomically within a session
- Use `withTransaction` utility for every wallet operation
- Record `balanceBefore` and `balanceAfter` in every `walletTransaction` document

### 7.3 Payment Webhook Idempotency

- Before processing any Razorpay webhook, check if the payment has already been processed
- Use the idempotency utility in `shared/utils/idempotency.ts`
- Key format: `payment-processed:{razorpayPaymentId}`
- Store in Redis with long TTL (24 hours minimum)
- If already processed, return 200 OK and do nothing

Without this, double-refunds and double-bookings WILL happen in production.

### 7.4 Transaction Utility

Every operation that modifies multiple documents (booking + payment, wallet debit + transaction log, etc.) MUST use the `withTransaction` wrapper:

```typescript
const result = await withTransaction(async (session) => {
  await walletRepository.debit(userId, amount, session);
  await walletTransactionRepository.create(txData, session);
  return { success: true };
});
```

Never modify multiple documents without a transaction.

### 7.5 System Config Caching

- System config values are loaded into Redis/memory on startup
- Refreshed every 5 minutes automatically
- All modules read config from `configService`, never from MongoDB directly
- Admin config updates must invalidate the cache immediately (force-refresh)
- Config key naming: `booking.advanceAmount`, `cancellation.userLifetimeLimit`, etc.

### 7.6 Slot Availability Calculation

This is the most complex calculation in the system. It must follow this exact order:

1. Get barber's availability for today (working hours, breaks, isWorking flag)
2. If not working → return empty
3. Get existing confirmed bookings for barber on date
4. Get active slot blocks (walk-ins) for barber on date
5. Get active slot locks (payment in progress) for barber on date
6. Calculate available windows: Working hours − breaks − bookings − blocks − locks
7. Generate slot start times at configured interval (default 15 min) where the service duration fits completely
8. Filter out slots earlier than now + minimum buffer (default 30 min)
9. Return list of available slot start times

Never skip steps 4 or 5. Walk-in blocks and payment locks are critical.

### 7.7 Vendor Cancellation Weekly Counter

- `cancellationsThisWeek` must be reset every Monday (use a scheduled Bull job)
- When count exceeds the configured limit (default 5), set `isFlagged: true`
- Flagging is automatic; admin reviews manually

---

## 8. Database Rules

### 8.1 Schema Rules

- All collections use the schemas defined in the project context document (19 collections)
- Do not add fields without documenting them
- Denormalized fields (e.g., `userName` in bookings) must be updated if the source changes
- Use `status` fields with explicit string enums, never booleans for multi-state entities
- Timestamps: `createdAt` and `updatedAt` on every collection (use Mongoose timestamps option)

### 8.2 Indexing Rules

- Every query pattern must have a supporting index
- Compound indexes must match the query field order
- Geo queries on `shops.location` use `2dsphere` index
- TTL index on `slotLocks.expiresAt` for auto-expiry
- Unique indexes where documented (phone, email, bookingNumber, etc.)
- Review index performance as scale grows

### 8.3 Soft Deletes

Entities are never hard-deleted. Use status fields:

- Users: `"ACTIVE"`, `"BLOCKED"`, `"DELETED"`
- Vendors: `"PENDING"`, `"ACTIVE"`, `"SUSPENDED"`, `"DELETED"`
- Services/Barbers: `isActive: boolean` + `status: "ACTIVE" | "DELETED"`

All queries must filter by appropriate status/isActive unless explicitly fetching all.

---

## 9. API & HTTP Rules

### 9.1 Route Naming

- REST conventions: plural nouns, no verbs in URLs
- `GET /api/v1/shops` — list shops
- `GET /api/v1/shops/:id` — get shop details
- `POST /api/v1/bookings` — create booking
- `PATCH /api/v1/bookings/:id/cancel` — cancel booking (action endpoints use PATCH)
- `PATCH /api/v1/bookings/:id/complete` — mark complete

### 9.2 API Versioning

All routes are prefixed with `/api/v1/`. No unversioned endpoints.

### 9.3 Authentication & Authorization

- User/Vendor: OTP-based phone authentication, JWT tokens
- Admin: Email/password authentication, JWT tokens
- Session timeout: 30 days for users/vendors, 8 hours for admins
- Every protected route goes through `authenticate` middleware first, then `authorize` middleware with required roles
- Never trust frontend-provided roles. Always verify from the token/session.

### 9.4 Role-Based Access

Three admin roles with strict permissions:

| Capability               | Super Admin | Sub Admin       | Association Admin |
| ------------------------ | ----------- | --------------- | ----------------- |
| All data                 | ✅          | ✅ (no revenue) | ❌                |
| Vendor verification      | ✅          | ✅              | ❌                |
| Financial reports        | ✅          | ❌              | ❌                |
| Association revenue view | ❌          | ❌              | ✅ (own only)     |
| System configuration     | ✅          | ❌              | ❌                |
| Admin management         | ✅          | ❌              | ❌                |

Enforce at the middleware level. Never rely on frontend hiding UI elements.

---

## 10. Business Logic Rules

These rules come directly from the product specification. They are not negotiable.

### 10.1 Booking

- Same-day only. No advance booking for future days.
- Auto-confirmed on payment. No vendor accept/reject step.
- Minimum 1 service required per booking.
- Advance amount: ₹10 (configurable via system config)
- Minimum booking buffer: 30 minutes from now (configurable)
- Slot interval: 15 minutes (configurable)
- Buffer between appointments: 5 minutes (configurable)
- Slot lock during payment: 5 minutes TTL (configurable)
- Booking number format: `FLB` + sequential number (e.g., `FLB12345`)
- "Any Available" barber selection: system assigns based on availability

### 10.2 Cancellation — User

- Free cancellation (100% to wallet): if > 30 min since booking was made
- Late cancellation (50% to wallet): if < 30 min since booking was made
- Lifetime cancellation limit: 10 (configurable)
- After limit reached: user must contact support
- Refund destination: always WALLET for user-initiated cancellations

### 10.3 Cancellation — Vendor

- Always 100% refund to ORIGINAL payment method
- Reason is required (Barber sick, Emergency, Shop closing, Equipment issue, Other)
- Vendor cancellation count incremented
- Weekly limit: 5 before auto-flagged for admin review (configurable)
- Weekly counter resets every Monday

### 10.4 Wallet

- Platform credit only (not real money withdrawal)
- Cannot add money manually
- Cannot withdraw
- Cannot transfer to other users
- Auto-applied if balance >= ₹10 during booking
- No partial wallet payment (full wallet OR full Razorpay, never split)
- No expiry in MVP

### 10.5 Payments

- ₹10 advance goes to platform (Super Admin)
- Remaining service amount paid directly at shop (not tracked in system)
- Association share: ₹2 per completed booking from association member vendors
- Association payout: manual bank transfer by Super Admin, tracked in system
- Independent vendor registration: one-time fee via Razorpay

### 10.6 Reviews

- One review per completed booking
- Rating: 1-5 stars (required)
- Comment: max 500 characters (optional)
- No edit, no delete by user
- Linked to both shop and barber
- Shop/barber ratings are calculated averages

### 10.7 Issue Reporting

- Available only around appointment time (±30 minutes)
- User must be within 500m of shop (location check)
- Issue types: SHOP_CLOSED, BARBER_NOT_AVAILABLE, EXCESSIVE_WAIT, OTHER
- Valid issues get auto-refund (₹10 to original payment method)
- Goes to admin queue for review

### 10.8 Vendor Registration

- Association members: free registration, manual admin verification of member ID
- Independent vendors: one-time paid registration, lighter verification
- Both require admin approval before going ACTIVE
- Vendor cannot use the platform until verification is APPROVED

### 10.9 Walk-in Slot Blocking

- "Quick Block" creates a slot block starting NOW
- Duration = default service duration + 5-minute buffer
- Block prevents online users from booking that time range
- Vendor can release block early or let it auto-expire

---

## 11. Logging Rules

### 11.1 Structured Logging

Every log entry must include:

- `timestamp`
- `level` (info, warn, error)
- `requestId` (correlation ID from middleware)
- `userId` or `vendorId` or `adminId` (when available)
- `module` (which module produced the log)
- `action` (what operation was attempted)

### 11.2 What to Log

- Every payment event (initiation, success, failure, refund)
- Every wallet balance change
- Every booking state change
- Every cancellation with reason
- Every slot lock acquire/release
- Every admin action (block, unblock, verify, reject)
- Every authentication event (login, logout, session expiry)
- All errors with full stack traces

### 11.3 What NOT to Log

- Passwords or OTPs
- Full credit card numbers
- Raw Razorpay signatures
- User personal data in plain text beyond what's needed for debugging

---

## 12. Code Style Rules

### 12.1 General

- Use `async/await` everywhere. No `.then()` chains.
- Use `const` by default. Use `let` only when reassignment is needed. Never `var`.
- Use explicit return types on all functions.
- Use meaningful variable names. No single-letter variables except in loops (`i`, `j`).
- No commented-out code in commits.
- No `console.log`. Use the structured logger.

### 12.2 Naming Conventions

- Files: `kebab-case` or `module.layer.ts` pattern (e.g., `booking.service.ts`)
- Variables and functions: `camelCase`
- Types and interfaces: `PascalCase`
- Enums: `PascalCase` for name, `UPPER_SNAKE_CASE` for values
- Constants: `UPPER_SNAKE_CASE`
- Database collection names: `camelCase` (as defined in schemas)

### 12.3 Imports

- Absolute imports for shared utilities: `@shared/errors/AppError`
- Relative imports within a module: `./booking.repository`
- Cross-module imports only for services: `../wallet/wallet.service`
- No circular imports. Ever.

---

## 13. What NOT to Build

These anti-patterns are explicitly prohibited:

- ❌ Generic `BaseRepository` or `BaseService` classes
- ❌ Abstract base classes with inheritance hierarchies
- ❌ Unnecessary interfaces (don't create `IBookingService` if there's only one implementation)
- ❌ Overuse of generics
- ❌ Framework within the framework (no custom DI containers, no custom ORM wrappers)
- ❌ Event bus or pub/sub within the monolith
- ❌ Separate domain layer or value objects
- ❌ CQRS or read/write model separation
- ❌ Barrel exports (`index.ts`) in modules

Keep it concrete. Keep it boring. Boring code scales.

---

## 14. Notifications

- Push notifications via Firebase Cloud Messaging (FCM)
- Vendor new-booking sound: 10 seconds, cannot be disabled
- User reminders: 1 hour and 30 minutes before appointment
- Voice readout (TTS): only when app is in foreground/background, toggleable by user
- Notification jobs run via Bull queue (not in the request cycle)

---

## 15. MVP Scope Boundaries

These features are explicitly NOT in MVP. Do not build them:

- Social login (Google/Facebook)
- Map view (Google Maps API)
- Reschedule booking (cancel + rebook instead)
- Add money to wallet / withdraw from wallet
- Wallet expiry
- Rate barber separately from shop
- Photo in review / vendor reply to review
- SMS / Email / WhatsApp notifications
- Service images or variants
- Revenue reports or analytics for vendors
- Export data
- Association CRUD (only one association exists)
- Custom admin permissions (fixed roles only)

---

## 16. Configurable Values (System Config)

All business-critical values are stored in the `systemConfig` collection and accessed via the config service. Never hardcode these:

| Key                                  | Default | Category     |
| ------------------------------------ | ------- | ------------ |
| `booking.advanceAmount`              | 10      | BOOKING      |
| `booking.minBufferMinutes`           | 30      | BOOKING      |
| `booking.appointmentBufferMinutes`   | 5       | BOOKING      |
| `booking.slotIntervalMinutes`        | 15      | BOOKING      |
| `booking.slotLockMinutes`            | 5       | BOOKING      |
| `cancellation.userFreeWindowMinutes` | 30      | CANCELLATION |
| `cancellation.userLateFeePercentage` | 50      | CANCELLATION |
| `cancellation.userLifetimeLimit`     | 10      | CANCELLATION |
| `cancellation.vendorWeeklyLimit`     | 5       | CANCELLATION |
| `revenue.associationSharePerBooking` | 2       | REVENUE      |
| `limits.maxPhotosPerShop`            | 10      | LIMITS       |
| `limits.maxServicesPerShop`          | 50      | LIMITS       |
| `limits.maxBarbersPerShop`           | 20      | LIMITS       |

---

## 17. Checklist Before Writing Any Code

Before implementing any feature, verify:

1. ☐ Which module does this belong to?
2. ☐ Does the controller only validate + call service + return response?
3. ☐ Is all business logic in the service layer?
4. ☐ Does the repository contain zero business logic?
5. ☐ Am I importing another module's service (not repository or model)?
6. ☐ Am I using `withTransaction` for multi-document writes?
7. ☐ Am I using the Redis lock for slot operations?
8. ☐ Am I reading config from `configService` (not hardcoded)?
9. ☐ Am I throwing custom errors (not raw `Error`)?
10. ☐ Am I logging critical operations (payments, wallet, state changes)?
11. ☐ Am I returning DTOs (not raw Mongoose docs) across module boundaries?
12. ☐ Is this feature in MVP scope?

---

_This document is the single source of truth for backend development rules. When in doubt, follow these rules. When rules conflict with a quick shortcut, the rules win._
