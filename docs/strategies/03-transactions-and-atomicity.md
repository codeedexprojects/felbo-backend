# Strategy: Transactions & Atomicity

Multi-document writes that must be consistent are wrapped in MongoDB transactions using the `withTransaction` helper. The codebase also has a deliberate convention for how to order external calls (Razorpay API) relative to database writes.

---

## `withTransaction` Helper

**File:** `src/shared/database/transaction.ts`

A thin wrapper around Mongoose's session API:

1. Opens a session.
2. Starts a transaction.
3. Executes the caller's callback with the session.
4. Commits on success.
5. Aborts on error and re-throws.
6. Always ends the session.

Repository methods that participate in a transaction accept an optional `ClientSession` argument. When a session is passed, the Mongoose operation is associated with it. When no session is passed, the operation runs outside any transaction.

---

## When Transactions Are Used

| Operation | What is atomic |
|---|---|
| Booking initiation (FelboCoin path) | Booking creation + coin debit |
| Booking confirmation (Razorpay path) | Payment status update + booking status update |
| Vendor registration confirmation | Payment record update + vendor verification status update |
| Barber cancellation (FelboCoin booking) | Booking cancellation + coin reversal |
| User cancellation (with coin refund) | Booking cancellation + coin credit + cancellation count increment |
| FelboCoin credit/debit | Coin balance increment/decrement + transaction log creation |
| Admin coin adjustments | Coin balance change + audit log creation |

The rule of thumb: if two writes must be consistent (either both happen or neither does), they belong in a transaction.

---

## External-First Ordering for Irreversible Operations

Some operations involve an external API call (Razorpay) that cannot be rolled back if it succeeds. The convention is:

**Call the external service first, then write to the database.**

### Why

If the database write happens first and then the external call fails, the DB is in a state that claims something happened that didn't. Rolling back is complex (requires a compensating write) and can be missed.

If the external call happens first and then the DB write fails, the external side-effect exists but is unrecorded. This is recoverable:
- For payments: the user's bank account was debited, but no booking was created. The user can contact support; a refund can be initiated manually or via reconciliation.
- For refunds: the refund was initiated, but the DB record wasn't updated. The next webhook event (`refund.processed`) will still arrive and can update the record.

The probability of the DB write failing after the external call succeeds is very low (the call already proved connectivity), so this ordering minimizes total risk.

### Examples in the codebase

**Booking initiation (Razorpay path):**
1. `createBookingAdvanceOrder` → Razorpay order created (external).
2. `withTransaction` → payment record saved + booking created (DB).

**Barber cancellation (Razorpay booking):**
1. `refundBookingAdvance` → Razorpay refund initiated (external), returns `refundId`.
2. `withTransaction` → booking marked cancelled with the `refundId` embedded (DB).

---

## Mongoose Create with Session

When creating documents inside a transaction, Mongoose requires the array form of `Model.create`:

```typescript
// Correct — session is accepted:
await Model.create([data], { session });

// Wrong — session is silently ignored:
await Model.create(data, { session });
```

All repository `create` methods use the array form when a session is present.

---

## Avoiding Stale Reads in Coin Mutations

Coin balance updates use `findOneAndUpdate` with `{ returnDocument: 'after' }`. This returns the committed value from MongoDB, not a value read before the update. The `balanceBefore` and `balanceAfter` fields in the transaction log are derived from this committed value, never from a separate read. This eliminates the possibility of recording incorrect balances due to concurrent updates.
