# Flow: Authentication

All four actors — User, Vendor, Barber, and Admin — have separate authentication mechanisms.
There is no shared auth module; each actor owns its own auth logic inside its own module.

---

## User Authentication

**Relevant files:** `src/modules/user/user.service.ts`, `src/shared/services/otp.service.ts`

Users authenticate exclusively via phone OTP. There is no password.

### Login / Register (same endpoint)

1. Client sends phone number to `POST /api/v1/user/auth/send-otp`.
2. Server calls `OtpService.sendOtp(phone, 'USER')`, which:
   - Enforces the daily OTP send cap via Redis (see [OTP Abuse Protection](../strategies/07-otp-abuse-protection.md)).
   - Delegates to the 2Factor.in SMS API (or `DevOtpService` in non-production).
   - Returns a `sessionId` that identifies this OTP session.
3. Server stores `{ sessionId → phone }` in Redis (via `OtpSessionService`) to bind the session to the phone number.
4. Client sends `{ sessionId, phone, otp }` to `POST /api/v1/user/auth/verify-otp`.
5. Server verifies the session phone matches the submitted phone (anti-substitution check).
6. Server calls `OtpService.verifyOtp(sessionId, otp)`. Verify attempts are capped per session.
7. If OTP is valid:
   - If no user exists for this phone, a new user record is created (`ACTIVE` status).
   - If user exists and is `DELETED`, a grace period check runs. After the grace period the account can be reactivated on next login.
   - If user is blocked, login is denied.
   - `lastLoginAt` is updated.
8. A short-lived JWT (access token) and a long-lived refresh token are issued. The refresh token hash is stored on the user record.
9. If the client passes an `fcmToken`, it is registered for push notifications.

### Refresh Token

- `POST /api/v1/user/auth/refresh-token` accepts the refresh token.
- Server verifies the token signature, fetches the user, and compares the token hash against the stored hash.
- If the stored hash does not match (token reuse), the stored hash is cleared immediately (rotation invalidation), and an error is returned.
- On success, both access and refresh tokens are rotated and the new hash stored.

### Logout

- Clears the stored refresh token hash and all FCM tokens from the user record.

---

## Vendor Authentication

**Relevant files:** `src/modules/vendor/vendor.service.ts`

Vendors also authenticate via phone OTP, but there are two distinct flows depending on whether they already have an account.

### Login (existing vendor)

1. `POST /api/v1/vendor/auth/send-otp` — same OTP send flow as users, daily cap enforced with `'VENDOR'` flow type (higher limit than users).
2. `POST /api/v1/vendor/auth/login/verify-otp`:
   - Checks vendor existence. If no vendor account exists for the phone, the request is rejected with a "please register" error.
   - Enforces status guards in order:
     - `PAYMENT_PENDING` → payment incomplete, cannot login.
     - `PENDING` → awaiting admin verification.
     - `REJECTED` → application denied, shows rejection reason.
     - `isBlocked` → account blocked by admin.
     - `SUSPENDED` → account suspended.
     - `DELETED` + within grace period → cannot login yet.
     - `DELETED` + grace period expired → account is reactivated, shop availability is restored.
   - Determines if the vendor is also a barber (`VENDOR_BARBER` role) by checking for a linked barber profile.
   - Issues access + refresh tokens. The JWT payload includes `{ sub: vendorId, role: 'VENDOR' | 'VENDOR_BARBER', barberId? }`.
   - Stores refresh token hash on the vendor record.
   - Returns onboarding status so the client knows where to direct the vendor.

### Vendor Role Duality

A vendor who is also a barber at their own shop receives the role `VENDOR_BARBER` in the JWT. The `barberId` is embedded in the token payload. This means:
- A single login gives them access to both vendor and barber API surfaces.
- The barber ID does not need to be fetched separately at runtime — it is in the token.

### Refresh Token

Same rotation strategy as users. Token reuse clears the stored hash immediately.

### Logout

Clears refresh token hash and FCM tokens from both the vendor record and the linked barber record.

---

## Barber Authentication

**Relevant files:** `src/routes/barber/`, `src/modules/barber/barber.service.ts`

Barbers are managed by vendors. A barber logs in via the barber-specific OTP endpoints. The flow is structurally identical to the vendor login flow. The resulting JWT has `role: 'BARBER'`.

If a vendor is also a barber at their shop, they use the vendor login flow and receive `role: 'VENDOR_BARBER'`. They do not use the barber-specific auth endpoints.

---

## Admin Authentication

**Relevant files:** `src/modules/admin/admin.service.ts`

Admins authenticate with email and password (bcrypt-hashed). There is no OTP for admins.

1. `POST /api/v1/admin/auth/login` accepts `{ email, password }`.
2. Server fetches the admin record by email and compares the password hash with `comparePassword`.
3. The JWT payload includes `{ sub: adminId, role: 'SUPER_ADMIN' | 'ASSOCIATION_ADMIN' }`.
4. No refresh token — admin sessions are access-token only.

---

## Request Authentication (Middleware)

**Relevant file:** `src/shared/middleware/authenticate.ts`

All protected routes go through the `authenticate` middleware:

1. Extracts the Bearer token from the `Authorization` header.
2. Verifies the JWT signature and expiry.
3. For `USER` role: checks two Redis keys — `user:blocked:{id}` and `user:deleted:{id}`. If either is set, the request is rejected immediately without hitting the database.
4. For `VENDOR` / `VENDOR_BARBER` role: checks `vendor:deleted:{id}` and `vendor:blocked:{id}` similarly.
5. Attaches the decoded payload to `req.user` for downstream handlers.

The Redis check is the key design decision here: admin actions (block, delete) write to Redis immediately, so the effect is near-instant without waiting for token expiry. See [Auth State in Redis](../strategies/06-auth-state-redis.md) for detail.

---

## Authorization (Role Guards)

**Relevant file:** `src/shared/middleware/authorize.ts`

After authentication, route-level role guards check `req.user.role` against the allowed roles for that route. If the role does not match, a `ForbiddenError` is thrown.
