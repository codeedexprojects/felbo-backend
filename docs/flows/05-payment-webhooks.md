# Flow: Payment & Webhooks

All monetary transactions go through Razorpay. The system uses Razorpay for order creation, payment capture, and refund initiation. Asynchronous outcomes (payment failure, refund completion) are communicated back via webhooks.

---

## Payment Purposes

There are two distinct purposes for Razorpay payments:

| Purpose | When | Notes |
|---|---|---|
| `BOOKING_ADVANCE` | User books a service | Advance amount is configurable (`BOOKING_AMOUNT`). Non-refundable for user cancellations. |
| `VENDOR_REGISTRATION` | Independent vendor registers | Fee amount is configurable (`VENDOR_REGISTRATION_FEE`). Refunded if vendor is rejected. |

Each payment is stored as a `Payment` document that tracks the full lifecycle.

---

## Payment Document Lifecycle

```
CREATED  →  PAID  (on successful verification)
         →  FAILED  (on webhook payment.failed or stale cleanup)
```

Each `Payment` document also has a `refunds` array. Each refund entry tracks `{ razorpayRefundId, amountPaise, status, initiatedAt, processedAt }`.

Refund statuses: `INITIATED → PROCESSED | FAILED`.

---

## Booking Advance Payment

### 1. Order Creation (`createBookingAdvanceOrder`)

Called during booking initiation (Razorpay path). Creates a Razorpay order with:
- Amount in paise.
- Receipt: `bk_{last6ofUserId}_{timestamp}`.
- Notes: `{ purpose: 'BOOKING_ADVANCE', userId, shopId }`.

Returns `{ orderId, receipt }` to the caller.

### 2. Payment Record Saved (`saveBookingPaymentRecord`)

Immediately after order creation, a `Payment` record is written to MongoDB with `status: 'CREATED'`. This and the booking creation happen inside the same MongoDB transaction.

### 3. Signature Verification (`verifyBookingPayment`)

After the user completes payment in the Razorpay SDK, the client submits `{ orderId, paymentId, signature }`. The server computes:

```
HMAC-SHA256(razorpayKeySecret, "{orderId}|{paymentId}")
```

and compares it to the submitted signature. A mismatch throws a `ValidationError`.

On success, the `Payment` document is updated: `status: 'PAID'`, `razorpayPaymentId`, `razorpaySignature`, `paidAt`. This update runs inside the same transaction as the booking confirmation.

---

## Vendor Registration Payment

The flow mirrors the booking advance pattern but is simpler (no associated booking record):

1. `createVendorRegistrationOrder` — creates the Razorpay order and the `Payment` record in one step (no need for a separate save step, since no booking transaction is involved).
2. `verifyVendorRegistrationPayment` — same HMAC verification. Updates the `Payment` to `PAID`.
3. If the vendor is later rejected, `refundVendorRegistrationPayment` is called.

---

## Refunds

### Booking Advance Refund (barber cancellation)

`refundBookingAdvance(razorpayPaymentId, amountPaise)`:
- Calls `razorpay.payments.refund(paymentId, { amount, notes })`.
- Returns the `refundId`.
- The refund entry on the `Payment` document is **not** updated here — refund status tracking happens asynchronously via the `refund.processed` webhook.

### Vendor Registration Refund (admin rejection)

`refundVendorRegistrationPayment(razorpayPaymentId)`:
- Fetches the `Payment` by `razorpayPaymentId`.
- Guards against double refunds (checks `status: 'REFUNDED'`).
- Calls `razorpay.payments.refund` for the full `amountPaise`.
- Adds a refund entry to the `Payment.refunds` array with `status: 'INITIATED'`.

### Issue Refund

When an admin resolves a dispute issue and processes a refund, `refundIssuePayment(razorpayPaymentId, amountPaise)` is called. Identical to the booking refund call but with different notes.

---

## Webhook Handler

**Route:** `POST /api/v1/webhooks/payment`

**Relevant file:** `src/modules/payment/payment.service.ts` — `handleWebhook`

### Security

The raw request body is preserved at the Express level (before JSON parsing) so it can be used for signature verification:

```
Razorpay.validateWebhookSignature(rawBody, signature, webhookSecret)
```

If validation fails, a `ValidationError` is thrown (returns 400).

### Handled Events

**`payment.failed`**

The `Payment` document is found by `razorpayOrderId` and updated to `status: 'FAILED'`. The associated booking is not touched here — the status healer cron handles stale `PENDING_PAYMENT` bookings separately.

**`refund.processed`**

1. Finds the `Payment` document by `razorpayPaymentId`.
2. Finds the refund entry in `Payment.refunds` by `razorpayRefundId`.
3. Updates the refund entry: `status: 'PROCESSED'`, `processedAt: now`.
4. Calls `BookingRepository.markCancellationRefundCompleted(refundId)` — updates the booking's cancellation `refundStatus` to `'COMPLETED'`.
5. Calls `IssueService.markIssueRefundCompleted(refundId)` — updates the issue's `refundStatus` to `'COMPLETED'` if this refund was for an issue.

**`refund.failed`**

1. Updates the `Payment.refunds` entry to `status: 'FAILED'`.
2. Calls `BookingRepository.markCancellationRefundFailed(refundId)`.
3. Logs a warning. Manual intervention may be needed.

**All other events** are logged and ignored.

---

## Key Design Notes

- The raw body is captured before Express parses JSON, because Razorpay's HMAC is computed over the exact raw bytes received. Parsing and re-stringifying changes the byte sequence.
- Refund initiation is always external-first (before DB writes) to avoid the case where a DB write succeeds but the refund was never actually initiated. See [Transactions & Atomicity](../strategies/03-transactions-and-atomicity.md).
- Webhook events are the authoritative signal for refund completion — the server never polls Razorpay for refund status.
