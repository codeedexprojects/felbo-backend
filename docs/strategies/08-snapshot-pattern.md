# Strategy: Snapshot Pattern in Bookings

When a booking is created, the system copies the current state of relevant data — service names, prices, category names, barber name, shop name — directly into the booking document. This snapshot is never updated after creation.

---

## What Is Captured

The `Booking` document stores:

| Field | Copied from |
|---|---|
| `shopName` | `Shop.name` at booking time |
| `barberName` | `Barber.name` at booking time |
| `userName` | `User.name` at booking time |
| `userPhone` | `User.phone` at booking time |
| `services[].serviceName` | `Service.name` at booking time |
| `services[].categoryName` | `Category.name` at booking time |
| `services[].price` | `Service.basePrice` at booking time |
| `services[].durationMinutes` | `BarberServiceLink.durationMinutes` at booking time |
| `totalServiceAmount` | Sum of service prices at booking time |
| `advancePaid` | `BOOKING_AMOUNT` config value at booking time |
| `remainingAmount` | `totalServiceAmount - advancePaid` at booking time |

---

## Why

Without snapshots, a booking record would only store IDs (`serviceId`, `barberId`, etc.). To display a booking's details, the system would join against the current state of those referenced documents.

This creates several problems:

**Data drift:** If a service's name or price is changed after a booking is made, the booking history would show the new name and price, not what the customer actually agreed to. Audit trails become misleading.

**Deletion safety:** If a service or barber is removed from the system, all historical bookings referencing them would lose their data. Orphaned references would need null-handling everywhere.

**Query complexity:** Displaying booking history requires joins across multiple collections. With snapshots, the booking document is self-contained and can be displayed directly.

**Coin refund correctness:** When a barber cancels a FelboCoin-paid booking, the system needs to know exactly how many coins to refund — the amount originally debited. Since `booking.advancePaid` is captured at booking time, config changes to `BOOKING_AMOUNT` after the booking do not affect the refund calculation.

---

## Service Snapshots — Two-Step Fetch

During booking initiation, service data is fetched in two steps:

1. **Barber service links** are fetched to get the per-barber `durationMinutes` for each service. These can differ from the base service duration.
2. **Service records** are fetched to get `name`, `basePrice`, and `categoryName`.

Both are fetched once, merged, and written atomically with the booking. The snapshot is computed in memory and persisted in one transaction — there is no window where partial data could be recorded.

---

## What Is Not Snapshotted

The booking stores references (`userId`, `shopId`, `barberId`) alongside the snapshot data. These references are used for:
- Filtering (find all bookings by a user, by a shop, etc.).
- Cross-module lookups when the current state is needed (e.g., checking if a barber is still active).

The snapshot serves the display and audit use case. The references serve the query and operational use case. Both are needed.

---

## Immutability

Once written, snapshot fields on a booking are never updated. Even if a barber's name is corrected in the system, the booking retains the name as it was at booking time. This is intentional — the booking is a contract record.
