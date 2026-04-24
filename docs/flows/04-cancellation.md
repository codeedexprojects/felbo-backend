# Flow: Cancellation

Both users and barbers can cancel a confirmed booking. The rules, refund mechanisms, and side effects differ between the two.

Only `CONFIRMED` bookings can be cancelled. Attempting to cancel a `PENDING_PAYMENT` booking, a `COMPLETED` booking, or an already-cancelled booking returns an error.

---

## User Cancellation

**Endpoint:** `POST /api/v1/user/booking/:bookingId/cancel`

### Eligibility

- The booking must belong to the requesting user.
- The booking must be `CONFIRMED`.
- The booking's `startTime` must not have passed yet. Cancelling a booking that has already started or is in the past is rejected.

### Free Cancellation Window

The system checks how much time has elapsed since the booking was created (`createdAt`), not since the appointment time. If the elapsed time is within `FREE_CANCELLATION_WINDOW_MINUTES` (configurable), the cancellation is considered "early" and earns the user a FelboCoin refund.

The coin refund amount is `COIN_CANCELLATION_REFUND_COINS` (configurable). If the cancellation is late (outside the window), no coins are awarded.

### What Happens Atomically

Inside a single MongoDB transaction:
1. The booking `status` is set to `CANCELLED_BY_USER`.
2. The cancellation sub-document is written with `{ cancelledBy: 'USER', reason, refundCoins, refundType: 'FELBO_COINS', refundStatus: 'COMPLETED' }`.
3. If eligible for coins, `FelboCoinService.creditCoins` runs in the same session — coin balance is incremented and a `COIN_REFUND` transaction log is created.
4. `UserService.incrementCancellationCount` runs in the same session.

The cancellation state and the coin credit are always consistent — they either both succeed or both roll back.

### Note on Cash Refunds for User Cancellation

User cancellation does **not** trigger a Razorpay refund regardless of how the booking was paid. The advance payment is non-refundable in cash for user-initiated cancellations. The compensation is coins only (and only within the free window).

### Side Effects

- The 10-minute reminder job is cancelled from the BullMQ queue.
- A `BOOKING_CANCELLED_BY_USER` notification is enqueued to alert the barber.

---

## Barber / Vendor Cancellation

**Endpoint:** `POST /api/v1/barber/booking/:bookingId/cancel`

### Eligibility

- The booking must be assigned to the requesting barber.
- The booking must be `CONFIRMED`.

### Refund — FelboCoin-Paid Bookings

If the booking was paid with FelboCoins (`paymentMethod: 'FELBO_COINS'`):

Inside a single MongoDB transaction:
1. Booking status is set to `CANCELLED_BY_VENDOR`.
2. Cancellation sub-document is written with `refundCoins: coinRedeemThreshold`, `refundType: 'FELBO_COINS'`, `refundStatus: 'COMPLETED'`.
3. `FelboCoinService.creditCoins` runs in the same session with type `COIN_REVERSAL` — the exact coins originally debited are returned.

This is fully atomic. The user's coin balance is always consistent with the booking state.

### Refund — Razorpay-Paid Bookings

If the booking was paid via Razorpay:

1. **Before the transaction**, a Razorpay refund is initiated via `PaymentService.refundBookingAdvance`. This returns a `refundId`. This call is external and cannot be rolled back, so it happens before the DB write.
2. Inside a single MongoDB transaction:
   - Booking status is set to `CANCELLED_BY_VENDOR`.
   - Cancellation sub-document is written with `refundAmount`, `refundType: 'ORIGINAL'`, `refundStatus: 'PENDING'`, and the `refundId`.

The `refundStatus` stays `PENDING` until the `refund.processed` webhook arrives (see [Payment & Webhooks](./05-payment-webhooks.md)). The webhook updates both the `Payment` document and the booking's cancellation `refundStatus` to `COMPLETED`.

The external-first ordering ensures the refund is always initiated even if the DB write fails after it — a minor overcount is safer than a missed refund. See [Transactions & Atomicity](../strategies/03-transactions-and-atomicity.md).

### Vendor Flagging

After every barber-initiated cancellation, the system counts how many times that shop has cancelled in the current week (`cancellationsThisWeek`). If the count reaches or exceeds `SHOP_CANCEL_WEEKLY_LIMIT` (configurable), the vendor is automatically flagged (`isFlagged: true`). Flagged vendors are visible to admins for review. The barber's individual cancellation count is also incremented.

### Side Effects

- The 10-minute reminder job is cancelled from the BullMQ queue.
- A `BOOKING_CANCELLED_BY_BARBER` notification is enqueued to alert the user.

---

## Cancellation Summary

| Scenario | Refund Method | Atomic? | Async Completion? |
|---|---|---|---|
| User cancels (early window) | FelboCoins credited | Yes (transaction) | No |
| User cancels (late) | None | Yes (transaction) | No |
| Barber cancels (FelboCoins booking) | Coins reversed | Yes (transaction) | No |
| Barber cancels (Razorpay booking) | Razorpay refund | Partial (refund external-first) | Yes (webhook) |
