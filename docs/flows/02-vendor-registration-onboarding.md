# Flow: Vendor Registration & Onboarding

Vendors go through two distinct phases before they can accept bookings:
**Registration** (getting approved on the platform) and **Onboarding** (setting up their shop).

---

## Registration

There are two registration paths depending on the vendor type.

### Path A: Association Vendor (Free)

An association vendor is affiliated with a recognized barber association. Registration is free; the association validates membership offline.

```
send-otp → register-verify-otp → register-association → [Admin review] → Approved / Rejected
```

1. `POST /api/v1/vendor/auth/send-otp` — same OTP flow as login.
2. `POST /api/v1/vendor/auth/register/verify-otp`:
   - Verifies OTP, confirms no existing approved/pending account for this phone.
   - Returns a verified token; does not create any record yet.
3. `POST /api/v1/vendor/auth/register/association`:
   - Accepts owner details, association member ID, association ID proof (uploaded S3 URL), and shop details.
   - Creates the vendor record with `verificationStatus: 'PENDING'`, `status: 'PENDING'`.
   - No payment is required.
4. Admin reviews the application (see Admin Review below).

### Path B: Independent Vendor (Paid)

An independent vendor pays a one-time registration fee to be listed on the platform.

```
send-otp → register-verify-otp → register-independent-initiate → [Pay on Razorpay] → register-independent-confirm → [Admin review] → Approved / Rejected
```

1. OTP send and verify — same as association path.
2. `POST /api/v1/vendor/auth/register/independent/initiate`:
   - Accepts owner details, documents (S3 URLs), and shop details.
   - Fetches the registration fee from config (`VENDOR_REGISTRATION_FEE`).
   - Creates a Razorpay order for the fee amount.
   - Upserts the vendor record with `verificationStatus: 'PAYMENT_PENDING'`, linking the `registrationPaymentOrderId`.
   - Returns the `orderId` and `amount` so the client can open the Razorpay SDK.
3. Client completes payment in Razorpay SDK.
4. `POST /api/v1/vendor/auth/register/independent/confirm`:
   - Verifies the Razorpay payment signature (HMAC-SHA256).
   - Inside a MongoDB transaction:
     - Records the payment details (`amount`, `paymentId`, `paidAt`) on the vendor.
     - Updates `verificationStatus` to `'PENDING'`.
   - The vendor now enters the admin review queue.

### Admin Review

Admins see all pending vendors at `GET /api/v1/admin/vendors/verification-requests`.

- **Approve**: Sets `verificationStatus: 'APPROVED'`, `status: 'ACTIVE'`. Enqueues a `VENDOR_APPROVED` notification job — the vendor receives an FCM push.
- **Reject**: Sets `verificationStatus: 'REJECTED'`, stores the rejection reason in `verificationNote`. Enqueues a `VENDOR_REJECTED` notification job.
  - For independent vendors (who paid), `PaymentService.refundVendorRegistrationPayment` is called to issue a Razorpay refund. The refund is tracked asynchronously via webhook.

### Verification Status State Machine

```
PAYMENT_PENDING  →  PENDING  →  APPROVED
                             →  REJECTED
```

An approved vendor can log in. A rejected vendor cannot. A `PAYMENT_PENDING` vendor also cannot log in until payment is confirmed.

---

## Onboarding

After approval, a vendor must complete onboarding before their shop becomes visible to users. The onboarding is tracked via `shop.onboardingStatus` on the primary shop record.

### Onboarding Steps

```
Create Shop  →  Complete Profile  →  (Add Services)  →  (Add Barbers)  →  COMPLETED
```

The `onboardingStatus` field progresses through these states:

| Status | Meaning |
|---|---|
| `SHOP_DETAILS_PENDING` | Shop created but profile not yet complete |
| `SERVICES_PENDING` | Profile complete, no services added yet |
| `BARBERS_PENDING` | Services added, no barbers assigned |
| `COMPLETED` | Fully onboarded, shop is active |

**Step 1 — Create Shop**

`POST /api/v1/vendor/shop` — Creates the primary shop for the vendor. The vendor can have only one primary shop. Additional shops require separate admin approval (see Additional Shops below).

**Step 2 — Complete Profile**

`PUT /api/v1/vendor/shop/:shopId/complete-profile` — Submits full shop details: address, working hours per day of week, location coordinates (GeoJSON Point), photos (S3 URLs), description, etc. Advances `onboardingStatus` to `SERVICES_PENDING`.

**Step 3 — Add Services**

`POST /api/v1/vendor/service` — Adds barbering services (haircut, beard trim, etc.) with price and duration. Advances status to `BARBERS_PENDING`.

**Step 4 — Add Barbers**

`POST /api/v1/vendor/barber` — Creates barber profiles and links them to services. Each barber–service link records a `durationMinutes` which can differ from the base service duration for that specific barber. Advances status to `COMPLETED`.

Once `COMPLETED`, the shop's `status` becomes `ACTIVE` and it appears in user-facing searches.

### Checking Onboarding Status

`GET /api/v1/vendor/auth/onboarding-status` — Returns current `onboardingStatus` and primary shop details. Called by the vendor app to decide which onboarding screen to show.

---

## Additional Shops

A vendor with a completed primary shop can apply to open additional shops.

1. `POST /api/v1/vendor/shop/additional` — Submits the new shop for admin approval.
2. Admin reviews at `GET /api/v1/admin/shops/pending`.
3. Approve / Reject — same notification pattern as vendor approval. The shop `status` is set to `ACTIVE` or `REJECTED`.

---

## Vendor Account Deactivation

A vendor can self-deactivate (`DELETE /api/v1/vendor/auth/deactivate`):
- Sets `status: 'DELETED'` with a `deactivatedAt` timestamp.
- Writes `vendor:deleted:{id}` to Redis so existing tokens are invalidated immediately.
- Sets shop availability to `false` so the shop disappears from user searches.

A 10-day grace period applies. During this window, the vendor cannot log back in. After the grace period, logging in reactivates the account and restores shop availability.
