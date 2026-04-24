# Strategy: Auth State in Redis

JWTs are stateless by design — once issued, they are valid until they expire. But the platform needs the ability to immediately revoke access when an admin blocks or deletes an account. Waiting for the JWT to expire naturally (up to hours or days) is unacceptable.

The solution is to maintain a small piece of mutable state in Redis that the `authenticate` middleware checks on every request.

---

## The Keys

| Redis Key | Set when | Cleared when |
|---|---|---|
| `user:blocked:{userId}` | Admin blocks a user | Admin unblocks a user |
| `user:deleted:{userId}` | User self-deletes their account | User re-activates (next login after grace period) |
| `vendor:blocked:{vendorId}` | Admin blocks a vendor | Admin unblocks a vendor |
| `vendor:deleted:{vendorId}` | Vendor self-deactivates | Vendor re-activates (next login) |

All keys are set with a TTL equal to `config.jwt.expirySeconds` — the maximum remaining lifetime of any token issued before the action. After that TTL, any previously issued tokens have also expired, so the Redis key is no longer needed.

---

## How It Works

In `authenticate` middleware (`src/shared/middleware/authenticate.ts`):

After verifying the JWT signature and decoding the payload, two Redis `GET` operations run in parallel:

```
[isBlocked, isDeleted] = await Promise.all([
  redis.get(`user:blocked:{id}`),
  redis.get(`user:deleted:{id}`),
])
```

If either key is set (non-null), the request is rejected with a 401 immediately. No database read happens. No further middleware or controller code runs.

---

## Why Redis and Not the Database

The `authenticate` middleware runs on every authenticated request. Reading from the database on every request to check account status would add a DB round-trip to every API call. Redis is in-memory and responds in sub-millisecond time, making the overhead negligible.

The Redis keys are small (just a presence flag — the value is `'1'`). Storing them is cheap. The TTL-based auto-expiry means the keys clean themselves up without a background job.

---

## The Write Side

When an admin blocks a user:
1. The `UserService.blockUser(userId)` method sets `user.isBlocked: true` in MongoDB.
2. It also sets `user:blocked:{userId}` in Redis with the TTL.

From that moment, any in-flight token for that user will be rejected on the next request. The user effectively has no grace period — the next request after the block action fails.

When the admin unblocks, both the DB field and the Redis key are cleared.

---

## Vendor Account Deactivation

Self-deactivation is slightly different. When a vendor deactivates:
1. `vendor:deleted:{vendorId}` is set in Redis immediately.
2. The vendor's shop availability is set to `false` (shops stop appearing in searches).
3. Existing tokens become invalid immediately via the Redis key.

On re-login (after the grace period), the Redis key is deleted and the account is restored.

---

## Refresh Token Rotation

Redis-based invalidation handles active access tokens. Refresh tokens are handled separately: the hash of the current refresh token is stored on the user/vendor document. On refresh, the submitted token's hash is compared against the stored hash. If they don't match (token reuse or revocation), the stored hash is cleared and both tokens become invalid.

This means the complete revocation strategy is:
1. Immediate access token rejection via Redis key.
2. Refresh token invalidation via hash mismatch on next refresh attempt.
