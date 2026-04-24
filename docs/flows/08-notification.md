# Flow: Notification System

Notifications are delivered to mobile devices via Firebase Cloud Messaging (FCM). All notification delivery is asynchronous — events are enqueued to a BullMQ queue and processed by a background worker.

---

## Architecture

```
Business logic  →  notification.queue.ts (enqueue)  →  BullMQ (Redis)  →  notification.worker.ts (process)  →  FCM
```

**Relevant files:**
- `src/shared/notification/notification.queue.ts` — enqueue helpers
- `src/shared/notification/notification.worker.ts` — job processor
- `src/shared/notification/fcm.service.ts` — FCM send logic
- `src/shared/queue/bull.ts` — BullMQ setup

The queue is backed by Redis. The worker runs in the same process as the HTTP server but processes jobs independently.

The BullMQ dashboard (Bull Board) is mounted at `/queues` for visibility into job states.

---

## FCM Token Management

Each actor (user, vendor, barber) stores a list of FCM tokens. Multiple tokens per actor are supported because the same account can be active on multiple devices.

Tokens are added on login (if the client passes `fcmToken` in the login request) and cleared on logout.

---

## Notification Events

### Booking Events

| Job Name | Triggered By | Recipient |
|---|---|---|
| `BOOKING_CONFIRMED_USER` | Booking confirmed (after payment) | User |
| `NEW_BOOKING_BARBER` | Booking confirmed | Barber |
| `BOOKING_CANCELLED_BY_BARBER` | Barber cancels a booking | User |
| `BOOKING_CANCELLED_BY_USER` | User cancels a booking | Barber |
| `REMINDER_10MIN` | 10 minutes before appointment | User + Barber |

### Vendor Events

| Job Name | Triggered By | Recipient |
|---|---|---|
| `VENDOR_APPROVED` | Admin approves vendor | Vendor |
| `VENDOR_REJECTED` | Admin rejects vendor | Vendor |
| `SHOP_APPROVED` | Admin approves additional shop | Vendor |
| `SHOP_REJECTED` | Admin rejects additional shop | Vendor |

---

## Delayed Jobs (Reminders)

The `REMINDER_10MIN` job is the only delayed job in the system. When a booking is confirmed, the job is scheduled with a delay of `(appointmentTime - 10 minutes - now)` milliseconds:

- If the appointment is less than 10 minutes away, no job is scheduled (delay would be ≤ 0).
- The job is given a deterministic `jobId`: `reminder-10m-{bookingId}`. This makes it addressable for cancellation.

When a booking is cancelled (by either party), `cancelReminder10Min(bookingId)` looks up the job by its `jobId` in the queue and removes it. This prevents reminders from firing after a cancellation.

---

## Notification Persistence

In addition to FCM push, notification records are stored in MongoDB (`Notification` collection). This allows users and barbers to see their notification history in-app even if the push was missed.

`GET /api/v1/user/notifications` and `GET /api/v1/barber/notifications` return the persisted list.

Unread notification count is returned in the user's profile response (`unreadNotificationCount`), surfaced from `NotificationService`.

---

## Barber Cron Notifications

**Relevant file:** `src/shared/notification/barber.cron.ts`

A separate scheduled job sends barbers a daily summary of their upcoming appointments. This is distinct from the BullMQ queue — it is a `node-cron` scheduled function that runs once per day.

---

## Error Handling

FCM send failures do not throw — they are logged and swallowed. A failed push notification should never cause a job to fail and retry indefinitely. The job is considered complete as soon as the FCM call returns (success or failure).
