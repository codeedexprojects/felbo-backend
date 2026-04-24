# Strategy: IST Timezone Handling

All booking dates and times are computed in IST (India Standard Time, UTC+5:30). The server runs on UTC, so the codebase has explicit IST conversion logic wherever time comparisons matter for booking correctness.

---

## The Problem

Bookings are same-day only. "Today" means different things depending on timezone. At 11:30 PM UTC, it is already 5:00 AM the next day in IST. If the server evaluated "today" in UTC, a user in India might be unable to book for what they consider today, or conversely be allowed to book for what is already tomorrow in IST.

Similarly, slot availability (the 30-minute minimum buffer from now) must be computed in IST so that "now" reflects the user's local time.

---

## Key Utility Functions

**File:** `src/shared/utils/time.ts`

| Function | What it does |
|---|---|
| `getTodayInIst()` | Returns the start of the current calendar day in IST, as a UTC `Date` (midnight IST = 18:30 UTC previous day) |
| `getCurrentIstMinutes()` | Returns the current time expressed as minutes since midnight IST (used for slot boundary comparisons) |
| `parseDateAsIst(dateString)` | Parses a `YYYY-MM-DD` string as a date in IST, returns the corresponding UTC `Date` |
| `getIstDayRangeUtc()` | Returns `{ start, end }` UTC timestamps for the current IST calendar day |
| `getCurrentIstDate()` | Returns the current `Date` object in the IST offset (not a real timezone object — used for hour/minute extraction) |
| `buildAppointmentDate(date, startTime)` | Constructs a UTC `Date` for a given booking date + `HH:MM` start time in IST |
| `formatDateAsIst(date)` | Formats a UTC `Date` as `YYYY-MM-DD` in IST |
| `formatTimestampAsIst(date)` | Formats a UTC `Date` as a human-readable IST timestamp |
| `formatAppointmentTime(time)` | Formats `HH:MM` as 12-hour AM/PM (e.g., `"10:30"` → `"10:30 AM"`) |

---

## How Dates Are Stored

- **Booking `date`:** Stored as a UTC `Date` representing midnight IST (i.e., 18:30 UTC the previous calendar day). This is what `getTodayInIst()` returns.
- **Booking `startTime` / `endTime`:** Stored as `HH:MM` strings in IST (e.g., `"10:30"`). No timezone suffix. They are always treated as IST.
- **Barber availability `workingHours.start` / `end`:** Same — `HH:MM` IST strings.

Storing `startTime` as a string rather than a timestamp keeps slot comparison simple (string compare or minute-integer conversion is unambiguous in IST) and avoids the confusion of UTC-stored timestamps being displayed as UTC.

---

## Slot Time Arithmetic

Slot generation compares all times as **minutes since midnight IST**:

```
"10:30" → 10 * 60 + 30 = 630 minutes
```

The current time is obtained via `getCurrentIstMinutes()`, which takes the UTC time, adds 5 hours 30 minutes, and extracts hours and minutes. This gives the equivalent IST minute offset without any timezone library.

---

## The Cron Job Context

The status healer cron (`src/cron/statusHealer.ts`) runs via `node-cron` with `{ timezone: 'Asia/Kolkata' }`. This means the cron schedule expression is interpreted in IST. When the cron runs, it uses `getIstDayRangeUtc()` to build UTC date range filters for MongoDB queries, ensuring it operates on the correct IST calendar day.

---

## No Timezone Library

The codebase does not use `moment-timezone`, `date-fns-tz`, or `Luxon`. All IST conversions are done with arithmetic: `new Date(utcMs + 5.5 * 60 * 60 * 1000)`. This is intentional — the IST offset is fixed (+5:30, no DST), so a library adds no value and introduces a dependency for a problem that does not exist.
