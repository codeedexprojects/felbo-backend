# Flow: FelboCoin System

FelboCoins are the platform's internal loyalty currency. Users earn them through bookings and can spend them as an alternative to cash for the advance payment.

---

## Coin Lifecycle Overview

```
Booking Completed  →  COIN_EARNED  (credit)
Booking Initiated  →  COIN_REDEEMED  (debit, if coins used as payment)
Barber Cancels     →  COIN_REVERSAL  (credit, coins returned)
User Cancels Early →  COIN_REFUND  (credit, compensation coins)
Issue Resolved     →  COIN_REFUND  (credit, coins returned if booking was paid with coins)
Admin Action       →  ADMIN_CREDIT / ADMIN_DEBIT
```

---

## Coin Storage

The user's coin balance is stored directly on the `User` document (`felboCoinBalance: Number`). Every credit or debit goes through an atomic MongoDB operation (`$inc` with `findOneAndUpdate`).

Every operation also creates a `FelboCoinTransaction` log document that records the full audit trail: `type`, `direction` (`CREDIT` / `DEBIT`), `coins`, `balanceBefore`, `balanceAfter`, `bookingId`, `bookingNumber`, `description`.

The `balanceBefore` and `balanceAfter` are derived from the committed value returned by MongoDB, not from a prior read. This avoids stale-read race conditions.

---

## Atomicity

All coin mutations run inside MongoDB transactions:
- `creditCoins` and `debitCoins` accept an optional `ClientSession`.
- If a session is passed, the caller's transaction is extended (the coin op is part of the same atomic unit).
- If no session is passed, a new transaction is started internally.

This means: whenever a booking, cancellation, or issue resolution also needs to touch coins, it all happens in one transaction. There is no window where a booking is confirmed but coins haven't been debited.

---

## Earning Coins

Coins are earned when a booking is completed. The amount is `COIN_EARN_PER_BOOKING` from config.

This credit fires in `BookingService.completeBooking` (manual completion by barber) or in the status healer cron for system-completed bookings.

Coin earning does **not** apply to FelboCoin-paid bookings (the advance was already waived; earning coins on top would be double-dipping).

---

## Spending Coins (Advance Payment)

To use coins instead of paying Razorpay:
- The user must have a balance ≥ `COIN_REDEEM_THRESHOLD` (configurable).
- If eligible, the client passes `paymentMethod: 'FELBO_COINS'` in the initiate booking request.
- The system debits exactly `COIN_REDEEM_THRESHOLD` coins (not the full booking amount — coins waive the advance, not the full service price).
- The booking is immediately `CONFIRMED` (no Razorpay round-trip needed).
- The coin debit and booking creation happen in the same transaction.

The threshold approach (rather than per-rupee exchange) keeps the logic simple: you either have enough coins to waive the advance, or you don't.

---

## Refund Scenarios

| Trigger | Type | Amount |
|---|---|---|
| Barber cancels (coins-paid booking) | `COIN_REVERSAL` | Exactly `COIN_REDEEM_THRESHOLD` — the original debit amount |
| User cancels within free window | `COIN_REFUND` | `COIN_CANCELLATION_REFUND_COINS` from config |
| Issue resolved (coins-paid booking) | `COIN_REFUND` | `booking.advancePaid` — the amount originally debited |

For coin reversals on barber cancellations, the amount is always the threshold at the time of refund — the idea being that 1 coin = 1 advance rupee. Config changes after booking time don't affect the refund amount.

---

## Admin Controls

Admins can manually credit or debit a user's coins:
- `POST /api/v1/admin/felbocoin/users/:userId/credit`
- `POST /api/v1/admin/felbocoin/users/:userId/debit`

These create `ADMIN_CREDIT` / `ADMIN_DEBIT` transaction logs linking the admin ID for audit purposes.

---

## Analytics (Admin)

- Coin stats (total issued, total redeemed, net outstanding) — `GET /api/v1/admin/felbocoin/stats`
- Transaction listing with filters (type, direction, date range) — `GET /api/v1/admin/felbocoin/transactions`
- Coin trend over time (daily/weekly/monthly/yearly) — `GET /api/v1/admin/felbocoin/trend`
- User leaderboard by coin balance — `GET /api/v1/admin/felbocoin/leaderboard`
- Admin action log (all manual credits/debits) — `GET /api/v1/admin/felbocoin/logs`
