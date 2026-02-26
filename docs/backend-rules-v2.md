# Felbo — Backend Rules & System Context (v1.0)

**1. Project Identity:** Same-day haircut booking in Kerala. Users pay ₹10 advance online, rest at shop.
**Tech Stack:** Node.js, Express, TypeScript, MongoDB (Mongoose), Redis, Bull. Architecture: Modular Monolith.

**2. Architecture Rules:**
* **Style:** Service + Repository Pattern. No DDD, Clean Arch, CQRS, or Microservices.
* **Module Structure:** Under `src/modules/<name>/`. EXACTLY 7 files: `.controller.ts`, `.service.ts`, `.repository.ts`, `.model.ts`, `.types.ts`, `.validators.ts`, `.routes.ts`. *No sub-folders, no `index.ts` barrel files.*
* **Shared (`src/shared/`):** Allowed cross-imports (db, redis, queue, middleware, errors, config, utils, constants, types, logger).

**3. Layer Responsibility (STRICT):**
* **Controller:** DO: Zod validation, call ONE service, return HTTP. DON'T: Biz logic, DB calls, multiple services, try/catch.
* **Service:** DO: Biz logic, call own repo/other services, `withTransaction`, Redis locks, throw `AppError`, map DB to DTOs. DON'T: Direct models, HTTP objects, raw DB docs across boundaries.
* **Repository:** DO: DB ops, session transactions, return Mongoose docs (to OWN service only). DON'T: Biz logic, call other repos/services, throw biz errors.
* **Model:** DO: Schema, indexes, virtuals, hooks. DON'T: Biz logic methods, import repos/services.
* **Validators:** DO: Zod schemas, sanitization. DON'T: DB lookups.
* **Types:** DO: DTOs, enums. DON'T: Mongoose types.

**4. Module Interaction ("The One Rule"):**
* Modules communicate ONLY via Services. Never import another module's Repository, Model, or Types. Cross-module data must be mapped to plain DTOs.

**5. Type Safety:**
* `strict: true`. No `any`, `@ts-ignore`, or raw Mongoose docs across boundaries. Explicit I/O types for all service methods. Controllers must use Zod `.parse()`.

**6. Error & Response Handling:**
* Throw custom `AppError` subclasses (`ConflictError`, `NotFoundError`, etc.) from services. 
* Central `errorHandler` formats all responses. No try/catch in controllers.
* **Success:** `{ "success": true, "data": { ... } }`
* **Error:** `{ "success": false, "error": { "code": "ERR", "message": "..." } }`

**7. Critical System Patterns:**
* **Slot Locking (Redis):** `SET slot-lock:{barberId}:{date}:{startTime} NX EX 300`. MUST acquire before payment, release on fail.
* **Wallet Concurrency:** Use `withTransaction` wrapper for multi-doc ops. Log `balanceBefore`/`balanceAfter` in `walletTransaction`.
* **Webhook Idempotency (Redis):** Key `payment-processed:{paymentId}` (24h TTL). Skip if exists.
* **Config Caching:** Load `systemConfig` to memory/Redis. Refresh every 5m.
* **Slot Calc Order (STRICT):** 1. Barber schedule -> 2. Stop if not working -> 3. Confirmed bookings -> 4. Walk-in blocks -> 5. Payment locks -> 6. Calc available -> 7. Gen 15m intervals -> 8. Filter <30m buffer -> 9. Return list.
* **Cancellation Counter:** Mon reset via Bull. >5 vendor cancels -> set `isFlagged: true`.

**8. Database Rules:**
* Use exact schemas context. Add compound, `2dsphere` (shops.location), TTL (`slotLocks.expiresAt`), and unique indexes.
* **Soft Deletes Only:** `status` (ACTIVE, BLOCKED, DELETED) or `isActive`. Query accordingly. 

**9. API, Auth & RBAC:**
* REST conventions (plural nouns, no verbs in URL). Prefix: `/api/v1/`.
* Auth: OTP/JWT (User/Vendor, 30-day timeout), Email/JWT (Admin, 8h timeout). Verified by `authenticate` -> `authorize` middleware.
* **RBAC:** * *Super Admin:* All data, Vendor verify, Financials, Config, Admin mgmt.
  * *Sub Admin:* All data (NO revenue), Vendor verify.
  * *Association Admin:* Own Association revenue view ONLY.

**10. Business Logic Boundaries:**
* **Booking:** Same-day only. Auto-confirmed on ₹10 payment. Min 1 service. Prefix `FLB12345`. "Any Available" barber system assigned.
* **Cancel (User):** Free (100% wallet) if >30m. Late (50% wallet) if <30m. 10 lifetime limit.
* **Cancel (Vendor):** 100% to ORIGINAL source. Reason required. 5/week limit.
* **Wallet:** Platform credit only. No manual add/withdraw/transfer. Auto-applies if >=₹10. Full wallet OR full Razorpay (no split).
* **Payments:** ₹10 advance to Platform. ₹2 to Association (manual payout). Reg fees via Razorpay.
* **Reviews:** 1 per completed booking. 1-5 stars. Max 500 chars. Average calc'd for shop/barber.
* **Issues:** Allowed ±30m of appt, within 500m. Valid issues auto-refund ₹10 to source.
* **Vendor Reg:** Assoc members (Free, Admin verifies ID), Independent (Paid one-time). Admin must APPROVE all.
* **Walk-in Blocks:** Duration = service + 5m buffer. Prevents online booking.

**11. Logging:**
* Structured: `timestamp, level, reqId, userId, module, action`. Log payments, wallet changes, state changes, errors. DO NOT log passwords, cards, or raw signatures.

**12. Code Style:**
* `async/await` everywhere, `const` default. explicit returns. `camelCase` vars, `PascalCase` types, `UPPER_SNAKE_CASE` constants. Absolute shared imports. No circular imports.

**13. Anti-Patterns (DO NOT BUILD):**
* Generic BaseRepositories/Services, OOP inheritance trees, pub/sub inside monolith, separate domain layers, CQRS, barrel files.

**14. Notifications:**
* FCM/Bull. Vendor new-booking sound (10s, non-mutable). User reminder 1.5h prior. TTS toggleable.

**15. MVP Out-of-Scope (DO NOT BUILD):**
* Social login, Maps API, Reschedule, Wallet top-up/withdraw/expiry, Split Barber/Shop ratings, Review photos/replies, SMS/WhatsApp, Export Data, custom admin roles.

**16. System Config Keys (Do Not Hardcode):**
* BOOKING: `advanceAmount` (10), `minBufferMinutes` (30), `appointmentBufferMinutes` (5), `slotIntervalMinutes` (15), `slotLockMinutes` (5).
* CANCEL: `userFreeWindowMinutes` (30), `userLateFeePercentage` (50), `userLifetimeLimit` (10), `vendorWeeklyLimit` (5).
* REVENUE: `associationSharePerBooking` (2).
* LIMITS: `maxPhotosPerShop` (10), `maxServicesPerShop` (50), `maxBarbersPerShop` (20).

**17. Pre-Code Checklist:**
1. Right module? 2. Controller pure? 3. Service has ALL logic? 4. Repo has NO logic? 5. Interacting via Services? 6. `withTransaction` used? 7. Redis lock used? 8. `configService` used? 9. `AppError` thrown? 10. Logged? 11. DTO returned? 12. In MVP scope?