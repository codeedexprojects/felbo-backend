# Flow: Booking Lifecycle

The booking flow is the most complex in the system. It involves slot computation, race-condition prevention, two payment paths, and post-confirmation side effects.

All bookings are same-day only. Advance scheduling is not supported.

---

## Booking Status Machine

```
PENDING_PAYMENT  →  CONFIRMED  →  COMPLETED
                             →  CANCELLED_BY_VENDOR
                             →  NO_SHOW
             →  CANCELLED_BY_USER  (stale payment timeout)
```

- `PENDING_PAYMENT`: Razorpay order created, waiting for user to complete payment.
- `CONFIRMED`: Payment verified (Razorpay) or coins debited (FelboCoins). Slot is reserved.
- `COMPLETED`: Service delivered. Set by barber or by the status healer cron.
- `CANCELLED_BY_VENDOR`: Barber cancelled a confirmed booking.
- `CANCELLED_BY_USER`: User cancelled, or the booking expired while in `PENDING_PAYMENT`.
- `NO_SHOW`: Barber marked the user as a no-show.

---

## Step 1: Browse Barbers

`GET /api/v1/user/booking/barbers?shopId=&serviceIds=`

Before picking a time slot, the user selects which services they want. This endpoint returns:
- All barbers at the shop who can perform all selected services.
- The current advance booking amount (from config).
- The user's current FelboCoin balance.
- The coin redeem threshold (to show whether coin payment is available).

A maximum of `maxServicesPerBooking` services can be selected per booking (configurable).

---

## Step 2: Get Available Slots

`GET /api/v1/public/slots?shopId=&barberId=&serviceIds=&date=`

This is the most computationally involved step. The slot generation algorithm runs entirely server-side.

### Inputs

- `barberId`, `shopId`, `serviceIds`, `date` (must be today in IST).

### Total Duration

Each barber–service link has its own `durationMinutes`. The total slot duration is the sum across all selected services for that specific barber.

### What Gets Blocked

Five layers of information are loaded:

| Layer | Source | Effect |
|---|---|---|
| Working hours | `BarberAvailability` today record | Defines the start/end of the bookable window |
| Breaks | `BarberAvailability` today record | Hard blocks within working hours |
| Confirmed bookings | `Booking` collection | Each booking blocks `startTime` to `endTime + appointmentBufferMinutes` |
| Slot blocks | `SlotBlock` collection | Walk-in or manual blocks set by the barber |
| Slot locks | `SlotLock` sub-collection inside `Booking` | Transient locks held by other users currently in the payment flow (TTL: 2 min) |

The appointment buffer (configurable, default 5 min) is added to each confirmed booking's end time to enforce a gap between back-to-back appointments.

### Earliest Bookable Time

Slots in the past or within `minBufferMinutes` of the current time (default 30 min) are marked unavailable.

### Slot Generation

Starting from `workStart`, slots are generated every `slotIntervalMinutes` (configurable). Each candidate slot is checked against all blocked ranges. A slot is marked `available: true` only if the entire duration `[start, start + totalDurationMinutes]` fits without overlapping any blocked range.

### If Barber Is Not Working

If `BarberAvailability.isWorking` is `false` for today, an empty slot list is returned immediately. No slot computation runs.

---

## Step 3: Initiate Booking

`POST /api/v1/user/booking/initiate`

This is where the booking record is created and payment is initiated.

### Pre-initiation Validations

Before creating anything:
1. Date must be today.
2. Shop must be `ACTIVE`.
3. Barber must belong to the shop and be available.
4. Services must be offered by the barber (same barber–service links).
5. Selected `startTime` must not be in the past or too soon (≥ `minBufferMinutes` from now).
6. Selected time must not overlap confirmed bookings, breaks, slot blocks, or slot locks.
7. Selected time must be within shop working hours.

### Slot Lock

Once all validations pass, a slot lock is created immediately:
- Records `{ barberId, date, startTime, endTime, lockedBy: userId, expiresAt: now + 2min }`.
- This prevents another user's concurrent initiation from grabbing the same slot during the payment window.
- See [Slot Locking](../strategies/04-slot-locking.md) for full detail.

### Booking Number & Verification Code

A 6-character alphanumeric booking number is generated (time-based + random). A 4-digit numeric verification code is also generated at this point and stored on the booking. The barber shows this code to the user at the shop to confirm identity before completing the booking.

### Path A: FelboCoin Payment

If the user selects `paymentMethod: 'FELBO_COINS'` and has sufficient balance (≥ `COIN_REDEEM_THRESHOLD`):

- Inside a single MongoDB transaction:
  - Booking is created with `status: 'CONFIRMED'` directly.
  - Coins are debited from the user (`COIN_REDEEMED` transaction log).
- Both the booking confirmation and coin debit are atomic — they either both succeed or both roll back.
- Notifications fire immediately: `NEW_BOOKING_BARBER` and `REMINDER_10MIN` (delayed job).

### Path B: Razorpay Payment

If the user selects `paymentMethod: 'RAZORPAY'`:

1. A Razorpay order is created via the Razorpay API (external call — cannot be rolled back).
2. Inside a single MongoDB transaction:
   - A `Payment` record is created (`status: 'CREATED'`).
   - A booking is created with `status: 'PENDING_PAYMENT'`, linked to the `razorpayOrderId`.
3. The `orderId` and amount are returned so the client can open the Razorpay SDK.

The reason for the external-first ordering is documented in [Transactions & Atomicity](../strategies/03-transactions-and-atomicity.md).

---

## Step 4: Confirm Booking (Razorpay path only)

`POST /api/v1/user/booking/:bookingId/confirm`

After the user completes payment in the Razorpay SDK, the client submits `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`.

1. Validates the booking belongs to this user and is still `PENDING_PAYMENT`.
2. Validates the `razorpayOrderId` matches the booking record (prevents order substitution).
3. Inside a single MongoDB transaction:
   - Verifies the payment signature (HMAC-SHA256: `orderId|paymentId` signed with the Razorpay key secret).
   - Updates `Payment` record: `status: 'PAID'`, stores `razorpayPaymentId`, `razorpaySignature`, `paidAt`.
   - Updates `Booking`: `status: 'CONFIRMED'`, stores `paymentId`.
4. After the transaction commits:
   - `NEW_BOOKING_BARBER` notification is enqueued.
   - `REMINDER_10MIN` delayed job is scheduled (fires 10 min before appointment time).

---

## Step 5: Booking Completion

### Manual Completion (by barber)

`POST /api/v1/barber/booking/:bookingId/complete`

The barber submits the user's verification code. The code is checked against `booking.verificationCode`. If it matches, status is set to `COMPLETED`.

### Automatic Completion (by cron)

The status healer cron (`src/cron/statusHealer.ts`) runs every 2 minutes and:
- Marks all `CONFIRMED` bookings from previous days as `COMPLETED`.
- Marks today's `CONFIRMED` bookings whose `endTime` has passed as `COMPLETED`.

This is a safety net. In practice, barbers should manually complete bookings, but the cron ensures no booking is left `CONFIRMED` indefinitely.

### No-Show

`POST /api/v1/barber/booking/:bookingId/no-show` — Marks the booking as `NO_SHOW`. No refund is issued.

---

## Stale Payment Cleanup

The status healer also cleans up bookings stuck in `PENDING_PAYMENT` for more than 10 minutes:
- These are bookings where the user started but never completed Razorpay payment.
- They are transitioned to `CANCELLED_BY_USER`.
- Their linked `Payment` records (status `CREATED`) are updated to `FAILED`.

---

## Post-Booking Coin Earning

After a booking is marked `COMPLETED`, the user earns FelboCoins (`COIN_EARN_PER_BOOKING` from config). This credit happens in the completion flow, not at booking time.

---

## Barber Availability System

The barber's schedule is managed separately from the shop's working hours.

**Weekly Presets**: A barber can define named schedule presets (e.g., "Mon–Fri 9–6 with lunch break"). Each preset specifies working hours and optional breaks.

**Daily Schedule**: Each morning (or on demand), a barber sets their schedule for the day by applying a preset or entering custom hours. This sets `isWorking`, `workingHours`, and `breaks` on today's `BarberAvailability` record.

**Slot Blocks**: Barbers can manually block out time ranges for walk-in customers or personal reasons (`POST /api/v1/barber/slot-blocks`).

The slot generation algorithm (Step 2) reads all three of these at query time.
