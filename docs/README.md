# Felbo Backend — Documentation

This directory documents the core flows and architectural strategies of the Felbo backend.
It is written for backend engineers onboarding to this codebase.
The code is the source of truth; these docs explain the _why_ and the _shape_ of each flow.

---

## Actors

| Actor | Role |
|---|---|
| **User** | End customer who books barber services |
| **Vendor** | Barbershop owner. Can also act as a barber (`VENDOR_BARBER` role). |
| **Barber** | The person performing services. Managed by the vendor. |
| **Admin** | Platform operators. Two subtypes: Super Admin and Association Admin. |

---

## Core Flows

| # | Flow | File |
|---|---|---|
| 1 | Authentication (all actors) | [flows/01-authentication.md](./flows/01-authentication.md) |
| 2 | Vendor Registration & Onboarding | [flows/02-vendor-registration-onboarding.md](./flows/02-vendor-registration-onboarding.md) |
| 3 | Booking Lifecycle | [flows/03-booking-lifecycle.md](./flows/03-booking-lifecycle.md) |
| 4 | Cancellation | [flows/04-cancellation.md](./flows/04-cancellation.md) |
| 5 | Payment & Webhooks | [flows/05-payment-webhooks.md](./flows/05-payment-webhooks.md) |
| 6 | FelboCoin System | [flows/06-felbocoin.md](./flows/06-felbocoin.md) |
| 7 | Issue / Dispute | [flows/07-issue-dispute.md](./flows/07-issue-dispute.md) |
| 8 | Notification System | [flows/08-notification.md](./flows/08-notification.md) |

---

## Architecture Strategies

| # | Strategy | File |
|---|---|---|
| 1 | Modular Monolith Structure | [strategies/01-modular-monolith.md](./strategies/01-modular-monolith.md) |
| 2 | Dependency Injection & Container Pattern | [strategies/02-dependency-injection.md](./strategies/02-dependency-injection.md) |
| 3 | Transactions & Atomicity | [strategies/03-transactions-and-atomicity.md](./strategies/03-transactions-and-atomicity.md) |
| 4 | Slot Locking | [strategies/04-slot-locking.md](./strategies/04-slot-locking.md) |
| 5 | Config-Driven Business Rules | [strategies/05-config-driven-rules.md](./strategies/05-config-driven-rules.md) |
| 6 | Auth State in Redis | [strategies/06-auth-state-redis.md](./strategies/06-auth-state-redis.md) |
| 7 | OTP Abuse Protection | [strategies/07-otp-abuse-protection.md](./strategies/07-otp-abuse-protection.md) |
| 8 | Snapshot Pattern in Bookings | [strategies/08-snapshot-pattern.md](./strategies/08-snapshot-pattern.md) |
| 9 | IST Timezone Handling | [strategies/09-ist-timezone.md](./strategies/09-ist-timezone.md) |
