# Strategy: Config-Driven Business Rules

Business rules that need to be tuned without a code deployment are stored in a `Config` collection in MongoDB and cached in Redis. The admin can change them at runtime.

---

## Why

Without this pattern, changing a value like the advance booking amount or the free cancellation window requires a code change, review, deployment, and rollout. Storing them in the database lets an admin update them instantly from the dashboard.

---

## Config Keys

**File:** `src/shared/config/config.keys.ts`

All config keys are typed constants. Services reference them by constant, not by string literal:

| Key | What it controls |
|---|---|
| `MIN_BOOKING_BUFFER_MINUTES` | Minimum time ahead a slot can be booked (default 30) |
| `APPOINTMENT_BUFFER_MINUTES` | Gap enforced after each confirmed booking (default 5) |
| `SLOT_INTERVAL_MINUTES` | Granularity of generated time slots |
| `BOOKING_AMOUNT` | Advance payment amount in rupees |
| `FREE_CANCELLATION_WINDOW_MINUTES` | Window after booking creation when user cancellation earns coins |
| `COIN_EARN_PER_BOOKING` | Coins earned on booking completion |
| `COIN_REDEEM_THRESHOLD` | Minimum coins needed to use FelboCoins as payment |
| `COIN_CANCELLATION_REFUND_COINS` | Coins credited on user early cancellation |
| `SHOP_MAX_DISTANCE_METERS` | Radius for nearby shop search |
| `RECOMMENDED_SHOPS_MAX_DISTANCE_METERS` | Radius for recommended shops |
| `ISSUE_MAX_DISTANCE_METERS` | Geofence radius for raising an issue |
| `SHOP_CANCEL_WEEKLY_LIMIT` | Max barber cancellations per week before vendor is flagged |
| `VENDOR_REGISTRATION_FEE` | Independent vendor registration fee in rupees |
| `VENDOR_REGISTRATION_GST_PERCENTAGE` | GST rate on the registration fee |
| `WALK_IN_FALLBACK_DURATION_MINUTES` | Default service duration for walk-in blocks with no service selected |

---

## How Values Are Fetched

**File:** `src/modules/config/config.service.ts`

`ConfigService.getValueAsNumber(key)` and `getValueAsString(key)`:

1. Check Redis for the key (`sysconfig:{key}`).
2. If found in cache, return the cached value immediately.
3. If not in cache, fetch from MongoDB `Config` collection.
4. Write the value to Redis with a 7-day TTL (`REDIS_TTL = 604800`).
5. Return the value.

The 7-day TTL means that after an admin updates a config value, the old value can still be served from cache for up to 7 days — unless the admin explicitly flushes it. In the current implementation, admin updates to config also delete the Redis key, so the next read always fetches the fresh value from MongoDB.

---

## Static Config vs Dynamic Config

Not all configuration comes from the database. Low-level infrastructure settings (database connection strings, JWT secret, AWS credentials, Razorpay API keys, OTP daily limits) are in environment variables, loaded at startup via `src/shared/config/config.service.ts` into a typed `config` object.

The rule is:
- Environment variables: secrets, infrastructure settings, things that differ between environments.
- Database config: business rules that ops/admin should be able to tune at runtime without a deployment.

---

## Default Values

**File:** `src/shared/config/config.defaults.ts`

Fallback values exist for all config keys. If a key is missing from both Redis and MongoDB (e.g., on a fresh deployment before config is seeded), the default is used. This prevents null-reference errors at startup.

---

## Admin Interface

Admins manage config values through:
- `GET /api/v1/admin/config` — list all config entries.
- `PUT /api/v1/admin/config/:key` — update a value (also clears the Redis cache entry).
