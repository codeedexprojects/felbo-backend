# Flow: Issue / Dispute

Users can raise a dispute against a booking if they believe something went wrong at the shop. The issue flow includes a geofence gate, admin adjudication, and a refund path.

---

## Raising an Issue

**Endpoint:** `POST /api/v1/user/issues`

**Relevant file:** `src/modules/issue/issue.service.ts` — `createIssue`

### Pre-conditions

1. The booking must exist and belong to the requesting user.
2. The booking's shop must match the submitted `shopId`.
3. The booking must not be in a cancelled state (no issues on cancelled bookings).
4. Only one issue can be raised per booking. If an issue already exists, a `ConflictError` is returned.

### Geofence Check

The user must be physically near the shop to raise an issue. The server receives the user's current GPS coordinates (`userLocation: { lat, lng }`), and computes the straight-line distance (Haversine formula) between the user and the shop's stored coordinates.

If the distance exceeds `ISSUE_MAX_DISTANCE_METERS` (configurable), the request is rejected with a message telling the user how far they are from the shop.

This prevents remote abuse — a user cannot raise an issue from home hours after leaving the shop.

### Issue Types

Issues are categorized by `type` (e.g., service not delivered, overcharge, etc.). The client selects one from a predefined enum.

### Razorpay Payment ID

If the booking was paid via Razorpay, the user submits their `razorpayPaymentId` with the issue. This is used later when the admin processes a refund.

---

## Issue Status Machine

```
OPEN  →  RESOLVED  →  (Refund processed)
      →  REJECTED
```

An issue can only move out of `OPEN` once. Attempting to update an issue that is already `RESOLVED` or `REJECTED` returns a `ConflictError`.

---

## Admin Adjudication

**Endpoint:** `PATCH /api/v1/admin/issues/:id/status`

Admin reviews the issue and sets status to `RESOLVED` or `REJECTED`, with an optional `adminNote` reason. The `reviewedBy` field is set to the admin's ID.

---

## Processing a Refund

**Endpoint:** `POST /api/v1/admin/issues/:id/refund`

This is a separate action from status update. The admin explicitly triggers the refund after marking an issue resolved.

**Pre-conditions:**
- Issue must be `RESOLVED`.
- Refund must not have been previously issued (`refundStatus` must not be `'ISSUED'` or `'COMPLETED'`).

### Razorpay-Paid Bookings

1. The booking's payment details are fetched (`getBookingPaymentDetails`).
2. If the issue includes a `razorpayPaymentId`, that is used; otherwise the payment ID from the booking is used.
3. `BookingService.refundIssuePayment` is called, which calls `PaymentService.refundIssuePayment(paymentId, amountPaise)` — a full refund of the advance paid.
4. The issue's `refundStatus` is updated to `'ISSUED'`, and the `refundId` is stored.
5. Refund completion is tracked via the `refund.processed` webhook, which eventually calls `IssueService.markIssueRefundCompleted`, setting `refundStatus: 'COMPLETED'`.

### FelboCoin-Paid Bookings

1. `BookingService.processIssueCoinsRefund` is called.
2. This credits back exactly `booking.advancePaid` coins to the user as a `COIN_REFUND`.
3. The issue `refundStatus` is updated to `'ISSUED'` synchronously (coin credit is immediate, no webhook needed).

---

## Vendor Flagging

**Endpoint:** `POST /api/v1/admin/issues/:id/flag-vendor`

The admin can flag the vendor associated with the issue:
- Sets `vendor.isFlagged: true`.
- If the vendor is already flagged, the response indicates `alreadyFlagged: true` without error.

Flagging is a signal for admin review. It does not automatically suspend the vendor.

---

## User-Facing Issue History

Users can view their own issues at `GET /api/v1/user/issues`. Each issue shows its current status, the linked booking, and the refund state.

---

## Refund Status Summary

| Payment Method | Refund Path | Completion Signal |
|---|---|---|
| Razorpay | `razorpay.payments.refund` | `refund.processed` webhook |
| FelboCoins | Coin credit (atomic) | Synchronous — no webhook |
