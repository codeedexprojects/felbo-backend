# Strategy: OTP Abuse Protection

The OTP system has two independent rate limits to prevent abuse: one on sending OTPs (preventing SMS cost inflation) and one on verifying OTPs (preventing brute-force guessing).

Both limits apply to both `TwoFactorOtpService` (production) and `DevOtpService` (development/testing), so the protection is active in all environments.

---

## Limit 1: Daily Send Cap

**Redis key:** `otp:daily:{normalizedPhone}` (phone includes country code, e.g. `919876543210`)

**TTL:** 24 hours (`DAILY_CAP_TTL = 86400`)

On every call to `sendOtp(phone, flowType)`:
1. `INCR otp:daily:{phone}` — atomically increments (or creates at 1) the counter.
2. If the counter was just created (count === 1), `EXPIRE` is set to 24 hours.
3. The current count is compared against the daily limit:
   - `USER` flow: `config.otp.dailyLimitUser` (default 8)
   - `VENDOR` flow: `config.otp.dailyLimitVendor` (default 10)
4. If the limit is exceeded, a `TooManyRequestsError` is thrown before the SMS API is called.

Vendors get a slightly higher daily limit because vendor registration involves more OTP round-trips (send OTP for login, send OTP for register-verify, send OTP again if re-attempting).

The INCR-then-EXPIRE pattern is atomic in Redis. There is no race condition between creating the key and setting its TTL.

---

## Limit 2: Verify Attempt Cap

**Redis key:** `otp:verify:{sessionId}`

**TTL:** 5 minutes (`VERIFY_CAP_TTL = 300`)

**Max attempts:** 5 (`VERIFY_MAX_ATTEMPTS = 5`)

On every call to `verifyOtp(sessionId, otp)`:
1. `INCR otp:verify:{sessionId}` — increments (or creates) the attempt counter for this session.
2. If count === 1, sets TTL to 5 minutes.
3. If the count exceeds 5, a `TooManyRequestsError` is thrown before any OTP check runs.
4. If the OTP is correct, the verify key is deleted (`DEL otp:verify:{sessionId}`). This frees the session for the next flow step.

The 5-minute TTL matches the natural OTP validity window from the 2Factor.in provider. After 5 minutes, both the OTP and the attempt counter expire together, so the session cannot be retried either.

---

## Session Phone Binding

`OtpSessionService` stores a `sessionId → phone` mapping in Redis when an OTP is sent. When the client submits a verify request, the server checks that the phone in the request matches the phone stored in the session.

This prevents an attack where a user sends an OTP to phone A, then submits the OTP with phone B's number. Without this check, a user could verify phone B using an OTP they received on phone A.

---

## Dev / Test OTP Service

`DevOtpService` (used when `NODE_ENV !== 'production'`) uses a fixed OTP (`fixedOtp`, default `'123456'`) for all numbers. It still enforces the daily send cap and the verify attempt cap through the same Redis logic.

A special test phone number (`test_phone`) bypasses all rate limits and always returns a deterministic session ID. This allows automated tests to run without hitting SMS rate limits or Redis.

---

## Where These Services Are Wired

`OtpService` is instantiated once in the user container and once in the vendor container. The two instances are independent (different flow types), but they share the same Redis connection, so the rate limits are enforced globally across all requests.
