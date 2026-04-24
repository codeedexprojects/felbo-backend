# Strategy: Slot Locking

Slot locking solves the race condition where two users query the same slot, both see it as available, and both attempt to book it simultaneously. Without a lock, both bookings could succeed and the barber would be double-booked.

---

## The Problem

The sequence without locking:

```
User A queries slots  →  slot 10:00 is available
User B queries slots  →  slot 10:00 is available
User A initiates booking for 10:00
User B initiates booking for 10:00
Both succeed → double booking
```

The window is real: between the slot query and payment completion, a Razorpay round-trip can take 15–60 seconds.

---

## The Solution: Short-Lived DB Locks

When a user initiates a booking, a `SlotLock` sub-document is created in the booking collection. It records:

```
{
  barberId,
  date,
  startTime,
  endTime,
  lockedBy: userId,
  expiresAt: now + SLOT_LOCK_MINUTES (2 minutes)
}
```

The slot generation query (Step 2 of the booking flow) includes active slot locks in the blocked ranges it checks. If User B queries slots while User A holds a lock, that slot appears unavailable to User B.

During booking initiation validation (Step 3), the lock check also runs — even if User B bypasses the slot query and submits a booking directly, the initiation will fail because the lock is detected.

---

## Lock Lifetime

The lock expires 2 minutes after creation (`SLOT_LOCK_MINUTES`). This is chosen to cover the Razorpay SDK payment window with margin. If the user abandons payment without completing it, the lock expires and the slot becomes available again.

The status healer cron (running every 2 minutes) cleans up stale `PENDING_PAYMENT` bookings older than 10 minutes, but it does not need to clean locks — locks expire naturally by TTL.

---

## Lock Cleanup

Slot locks are not deleted on booking confirmation. The lock record simply becomes irrelevant once the booking is `CONFIRMED` — the confirmed booking itself now occupies that slot in the blocked ranges calculation. If a confirmed booking is later cancelled, the slot opens up again without any lock record interaction.

---

## Why Not Redis Locks?

A Redis-based distributed lock (e.g., Redlock) was not used here because:

- The slot lock needs to be visible to the slot generation query, which runs against MongoDB. Keeping it in MongoDB means the same query that fetches confirmed bookings can also fetch locks — no cross-store join needed.
- Slot locks do not need sub-second precision. A 2-minute window is generous.
- MongoDB TTL indexes can expire records automatically, eliminating the need to explicitly release locks.

The trade-off is that MongoDB lock checks add a small read overhead to slot queries, which is acceptable given the query is already doing several reads at that point.

---

## Edge Cases

**User completes payment in under 2 minutes (normal case):** Lock is superseded by the confirmed booking. Slot stays occupied.

**User abandons payment (lock expires):** Slot becomes available after 2 minutes. Another user can now book it.

**Two users hit initiate simultaneously (sub-millisecond race):** Both pass the in-memory validation check. The lock write uses a MongoDB `insert` (not upsert), so only one can succeed if the two locks conflict. The second user's initiation will fail on the re-check after insertion attempt. (In practice, exact same-millisecond races are extremely rare for a barbershop booking product at this scale.)
