# Felbo - Complete Project Context Document (v1.0)

## 1. Project Overview & Scale
* **Concept:** Same-day haircut booking platform for Kerala barbershops. Users pay ₹10 advance online to lock a slot, and pay the remainder at the shop.
* **Target Scale (Month 1 -> Month 6):** Vendors (4,000 -> 35,000), Daily Bookings (40,000 -> 200,000+), Users (100K+ -> 500K+).

## 2. Business & Revenue Model
* **Platform Revenue:** Retains the ₹10 advance paid by the user.
* **Association Partnership:** Platform manually pays ₹2 per completed booking to the Kerala Barbers Association for bookings made at *member vendors*.
* **Vendor Reg Fees:** Association members register for Free. Independent vendors pay a one-time fee (Amount TBD) via Razorpay.
* **Payment Flow:** User pays ₹10 advance -> goes to Platform (Super Admin) -> User pays balance at shop -> End of month: Platform pays ₹2/booking to Association.

## 3. Technical Stack & Architecture Decisions
* **Stack:** Mobile Apps (Flutter), Backend (Node.js/Express), Admin Panel (React.js), DB (MongoDB), Hosting (AWS behind LB), Gateway (Razorpay), Push (FCM). Languages: English, Malayalam.
* **Architecture Rationales:**
  * **Monolith:** Sufficient for 40K-200K daily bookings; simpler deployment than microservices.
  * **No Kubernetes:** Overkill until 500K+ bookings/day. 2-3 Node instances are enough.
  * **Redis & Bull:** Used for caching, session management, and background jobs.
  * **No SMS / No Google Maps API:** Cost-saving measure. Push notifications and raw GPS coordinates/distance calculations used instead.

## 4. User Roles & Admin Permissions
* **User (App):** Books appointments.
* **Vendor (App):** Shop owner. Manages shop and barbers.
* **Barber:** Employee. *No login; managed entirely via Vendor app.*
* **Admin Roles (Web):**
  * **Super Admin:** Full access to all data, dashboards, vendor verifications, user/booking mgmt, revenue reports, payouts, cancel mgmt, configs, and admin creation.
  * **Sub Admin:** Full access EXCEPT: Dashboard Revenue, Revenue Reports, Association Payout Tracking, System Configs, and Admin Mgmt.
  * **Association Admin:** Can ONLY view filtered Dashboard, filtered Vendor List, filtered Booking List, and Association Revenue View (own share and payout history).

## 5. Core Business Rules
* **Booking:** Same-day only. Min buffer: 30 mins from `now`. Slot interval: 15 mins. Appt buffer: 5 mins. Slot lock: 5 mins. Auto-confirmed on ₹10 payment (no vendor accept/reject).
* **Cancel (User):** >30m after booking = ₹10 (100%) to Wallet. <30m after booking = ₹5 (50%) to Wallet. User No-Show = ₹0. *Limit: 10 lifetime.*
* **Cancel (Vendor):** 100% refund to original payment method. *Limit: 5/week* -> Auto-flags for admin review.
* **Wallet:** Platform credit only. Auto-applies if balance >= ₹10. No add money, withdraw, transfer, or partial split payments.
* **Shop Types:** `MENS`, `WOMENS`, `UNISEX`.

## 6. User App Features (Granular)
* **Auth:** 10-digit phone, 6-digit OTP (60s resend). Basic profile (Name, optional Email). 30-day session.
* **Discovery:** Auto-GPS or text search. Shows nearby shops sorted by distance ("1.2 km away") and Open/Closed status. Filters: Rating (3+/4+), Service, Avail Now, Shop Type.
* **Shop Details:** Display Name, Type, Address (text), Distance, Average Rating, Today's Hours, max 10 Swipeable Photos, Heart Fav icon. List of Services (price/duration) & Barbers (rating/avail). Reviews list (Count, Avg).
* **Booking Flow:** Select Service(s) [min 1] -> Select Barber or "Any Available" (filters out incapable barbers) -> Select Date ("Today" only) & Time (grouped Morning/Afternoon/Evening) -> Summary (Total, Advance, Remaining, Wallet apply) -> Pay (Wallet/Razorpay) -> Confirm screen (ID: FLB12345).
* **Booking Mgmt:** View Upcoming (Today) & Past (last 30 days). Cancel button (shows refund rules). 
* **Report Issue:** Only allowed ±30m of appt AND <500m from shop. Types: `Shop closed`, `Barber not available`, `Excessive wait`, `Other`. Auto-refunds ₹10 to original payment if valid.
* **Reviews:** 1 per completed booking. 1-5 stars. Max 500 chars. Auto-linked. Cannot edit/delete.
* **Favorites:** Save/Remove via Heart icon. List shows "Currently Unavailable" if shop inactive.
* **Voice/Push:** 1hr and 30m push reminders + TTS voice readout ("Your appointment at [Shop] is in [Time]") if app is open/background. Voice toggleable in settings.

## 7. Vendor App Features (Granular)
* **Reg & Auth:** Phone/OTP. Reg Type -> Assoc (Requires Member ID, Admin manual verify) vs Indep (Paid one-time fee, faster doc verify). Upload license/owner ID. Track Verification (Pend/App/Rej).
* **Shop Profile:** Edit name, type, owner, text address, GPS coordinates, max 10 photos, standard daily working hours, mark holidays.
* **Services:** Add Custom or System Categories. Fields: Name, Price, Description, ApplicableFor, Base Price/Duration.
* **Barbers:** Add name, phone, photo. Assign services (override duration/price). Set Default Service.
* **Daily Availability:** Set today's open/close & breaks *every morning*. Cannot set advance days.
* **Emergency Half-Day Leave:** Barber leaves early -> Select leave time -> UI shows affected bookings -> Vendor manually cancels each -> Triggers full refund -> Increases cancel count.
* **Booking Mgmt:** Dashboard (Today's count, Upcoming, Completed, Online revenue). List filtered by barber/status. Details (Call customer). Mark Complete. Cancel (Requires reason).
* **Walk-In / Quick Block:** 1-tap block from dashboard. Starts `now`. Duration = default service + 5m buffer.
* **Alerts:** Un-mutable 10-second loud sound for new bookings. TTS voice readout of customer/service/time.

## 8. Admin Panel Features (Granular)
* **Auth:** Email/Pass. Forgot password. 8hr session timeout.
* **Dashboards:** Super (All stats), Sub (No revenue), Assoc (Own vendors/revenue only).
* **Vendor Mgmt:** List, search, filter (Status/Type). View full details/docs/cancel rates. Verify member ID -> Approve/Reject. Suspend/Block/Unblock.
* **User Mgmt:** List, search. View history, balance, cancel count. Block/Unblock.
* **Booking & Issue Mgmt:** List, filter, search. View full details. Issue manual refunds. Resolve/Reject issues. Flag vendors at fault.
* **Financials:** Revenue overview/reports. Export to CSV. Filter by vendor/date. Refund tracking.
* **Association Payout Tracking:** Select month -> system counts `COMPLETED` Assoc bookings -> shows ₹2/booking total -> Admin pays manually via bank -> Marks "PAID" with notes -> Saves in history.
* **Cancellation Mgmt:** Dashboard of Flagged Vendors (>5 cancels/week). Actions: Mark Reviewed, Send Warning, Block Vendor.

## 9. Database Schemas (Mongoose) & Indexes
*(All schemas include `createdAt` & `updatedAt`)*
1. **users:** `phone`(Uniq), `name`, `email`, `walletBalance`(Def:0), `cancellationCount`(Def:0), `status`(ACTIVE/BLOCKED/DELETED), `lastLoginAt`. *(Idx: phone, status)*
2. **vendors:** `phone`(Uniq), `email`, `ownerName`, `registrationType`(ASSOC/INDEP), `associationMemberId`, `associationIdProofUrl`, `registrationPayment`{amount,paymentId,paidAt}, `documents`{shopLicense,ownerIdProof}, `verificationStatus`(PEND/APP/REJ), `verificationNote`, `verifiedAt`, `verifiedBy`, `notificationSettings`{voiceAnnouncements:Bool, Def:true}, `cancellationCount`, `cancellationsThisWeek`, `lastCancellationAt`, `isFlagged`, `flaggedAt`, `isBlocked`, `blockedAt`, `blockedBy`, `blockReason`, `status`(PEND/ACT/SUSP/DEL), `lastLoginAt`. *(Idx: phone, verificationStatus, status, isBlocked, isFlagged, registrationType)*
3. **shops:** `vendorId`, `name`, `description`, `shopType`(MENS/WOMENS/UNISEX), `phone`, `address`{line1,line2,area,city,district,state,pincode}, `location`{type:"Point", coordinates:[lng,lat]}, `workingHours`{monday:{open,close,isOpen},...}, `photos`([Str], Max:10), `rating`{average,count}, `isActive`(Bool), `status`. *(Idx: vendorId, location:2dsphere, shopType, status+isActive, rating.average, address.city)*
4. **barbers:** `shopId`, `vendorId`, `name`, `phone`, `photo`, `rating`{average,count}, `defaultServiceId`, `isActive`, `status`. *(Idx: shopId, vendorId, shopId+isActive+status)*
5. **serviceCategories:** `shopId`(null=system), `name`, `displayOrder`, `isActive`. *(Idx: shopId+isActive+displayOrder)*
6. **services:** `shopId`, `categoryId`, `name`, `description`, `basePrice`, `baseDurationMinutes`, `applicableFor`(MALE/FEMALE/ALL), `isActive`, `status`. *(Idx: shopId+isActive, shopId+categoryId+isActive)*
7. **barberServices:** `barberId`, `serviceId`, `shopId`, `price`, `durationMinutes`, `isActive`. *(Idx: barberId+serviceId uniq, barberId+isActive, shopId+serviceId+isActive)*
8. **barberAvailability:** `barberId`, `shopId`, `date`, `isWorking`, `workingHours`{start,end}, `breaks`[{start,end,reason}]. *(Idx: barberId+date uniq, shopId+date)*
9. **bookings:** `bookingNumber`("FLB12345" Uniq), `userId`, `userName`, `userPhone`, `shopId`, `shopName`, `barberId`, `barberName`, `barberSelectionType`(SPECIFIC/ANY_AVAILABLE), `date`, `startTime`, `endTime`, `totalDurationMinutes`, `services`[{serviceId,serviceName,categoryName,durationMinutes,price}], `totalServiceAmount`, `advancePaid`(10), `remainingAmount`, `paymentId`, `status`(CONFIRMED/COMPLETED/CANCELLED_BY_USER/CANCELLED_BY_VENDOR/NO_SHOW), `cancellation`{cancelledAt,cancelledBy,reason,refundAmount,refundType(WALLET/ORIGINAL),refundStatus}, `completedAt`. *(Idx: bookingNumber uniq, userId+status, shopId+date+status, barberId+date+status)*
10. **slotBlocks:** `shopId`, `barberId`, `date`, `startTime`, `endTime`, `serviceId`, `serviceName`, `durationMinutes`, `reason`(WALK_IN/BREAK/OTHER), `status`(ACTIVE/RELEASED), `createdBy`, `releasedAt`. *(Idx: barberId+date+status, shopId+date)*
11. **slotLocks:** `shopId`, `barberId`, `date`, `startTime`, `endTime`, `lockedBy`, `expiresAt`(TTL). *(Idx: expiresAt expireAfterSeconds:0, barberId+date+startTime)*
12. **payments:** `bookingId`(Uniq), `userId`, `amount`, `method`(RAZORPAY/WALLET), `razorpay`{orderId,paymentId,signature}, `walletTransactionId`, `status`(PENDING/CAPTURED/FAILED/REFUNDED), `refund`{amount,type,razorpayRefundId,walletTransactionId,status,refundedAt}. *(Idx: bookingId uniq, userId, razorpay.paymentId)*
13. **walletTransactions:** `userId`, `type`(CREDIT/DEBIT), `amount`, `balanceBefore`, `balanceAfter`, `referenceType`(BOOKING_PAYMENT/CANCELLATION_REFUND/PROMOTIONAL), `referenceId`, `description`. *(Idx: userId, referenceType+referenceId)*
14. **reviews:** `bookingId`(Uniq), `userId`, `shopId`, `barberId`, `rating`, `comment`, `status`(ACTIVE/HIDDEN/DELETED). *(Idx: bookingId uniq, shopId+status, barberId+status)*
15. **userFavorites:** `userId`, `shopId`. *(Idx: userId+shopId uniq, userId)*
16. **bookingIssues:** `bookingId`, `userId`, `shopId`, `vendorId`, `barberId`, `type`(SHOP_CLOSED/BARBER_NOT_AVAILABLE/EXCESSIVE_WAIT/OTHER), `description`, `userLocation`{Point}, `distanceFromShop`, `photoUrl`, `refundAmount`, `refundStatus`, `status`(REPORTED/UNDER_REVIEW/RESOLVED/REJECTED), `reviewedBy`, `reviewedAt`, `adminNotes`. *(Idx: bookingId, vendorId, status)*
17. **admins:** `name`, `email`(Uniq), `phone`, `passwordHash`, `role`(SUPER_ADMIN/SUB_ADMIN/ASSOCIATION_ADMIN), `status`(ACTIVE/INACTIVE), `lastLoginAt`, `createdBy`. *(Idx: email uniq, role+status)*
18. **associationPayouts:** `month`, `year`, `totalBookings`, `sharePerBooking`(Def:2), `totalAmount`, `status`(PENDING/PAID), `paidAmount`, `paidAt`, `paidBy`, `paymentNotes`. *(Idx: year+month uniq, status)*
19. **systemConfig:** `key`(Uniq), `value`, `valueType`(NUMBER/STRING/BOOLEAN/JSON), `category`, `displayName`, `description`, `constraints`{min,max,options}, `updatedBy`. *(Idx: key uniq, category)*

## 10. Key Logic Flows
1. **User Booking Flow:** Shop -> Service -> Barber -> Time -> Redis Lock (5m) -> Pay ₹10 -> If success: Confirm & clear lock. If fail: Expire lock.
2. **User Cancel Flow:** Check lifetime count < 10 -> Check time > 30m (₹10 to wallet) or < 30m (₹5 to wallet) -> Confirm -> Cancel & Refund -> User cancel count +1.
3. **Vendor Cancel Flow:** Select booking -> Provide reason -> Cancel -> 100% refund to original payment -> Vendor cancel count +1 -> If > 5/week, flag account.
4. **Walk-in Block Flow:** Tap "Quick Block" -> Creates `slotBlock` for `now` to (`now` + default service duration + 5m buffer) -> Auto-expires at end time.
5. **Slot Calculation (Strict 8-Step):** Get `barberAvailability` -> Stop if `!isWorking` -> Fetch confirmed `bookings` -> Fetch `slotBlocks` -> Fetch `slotLocks` -> Subtract all from working hours -> Generate 15m intervals where service fits -> Filter out slots < (`now` + 30m buffer).
6. **Association Payout Flow:** Super Admin selects month -> Sys counts `COMPLETED` bookings for `ASSOCIATION` vendors -> Total = Count * ₹2 -> Admin pays manually -> Marks 'PAID'.
7. **Vendor Reg Flow:** Select Assoc (enter ID -> submit -> Admin verifies -> Approved) OR Indep (Upload docs -> Pay Razorpay fee -> Admin verifies -> Approved).
8. **Half-Day Leave:** Edit barber hours -> Set early end time -> View affected bookings -> Manually cancel each -> Customer refunded -> Cancel count +1.

## 11. Validations & Exact Error Messages
* **Phone:** 10 digits (starts 6-9). *"Enter valid 10-digit mobile number"*
* **OTP:** 6 digits, 60s. *"Enter 6-digit OTP"* | *"OTP expired. Tap resend"*
* **Names:** 2-50 chars. *"Enter valid name"*
* **Shop Name:** 3-100 chars. *"Enter valid shop name"*
* **Address:** 10-200 chars. *"Enter complete address"*
* **Service:** Price > 0 (*"Enter valid price"*), Duration 5-180m (*"Duration must be 5-180 minutes"*).
* **Working Hours:** End > Start. *"End time must be after start time"*
* **Booking Rules:** *"Select at least one service"* | *"Select a time slot"* | *"This slot was just booked. Please select another."* | *"You have reached your cancellation limit"*
* **Report Issue:** Must be <500m away (*"You must be at the shop to report"*) AND ±30m of appt (*"You can only report around appointment time"*).
* **Vendor Errors:** *"Your account is under verification."* | *"Verification rejected: [reason]"* | *"Cannot delete barber with upcoming bookings."* | *"Cannot delete service assigned to barbers."* | *"Your account has been suspended. Reason: [reason]"*
* **Network/Auth:** *"No internet connection. Check your network."* | *"Something went wrong. Please try again."* | *"Session expired. Please login again."*

## 12. Screen States
* Standardized across all apps/web: **Loading**, **Empty** (no shops/zero balance/no bookings), **Default**, **Error**.

## 13. Notifications (Push & Voice)
* **User Messages:**
  * "Booking confirmed at [Shop] for [Time]"
  * "Your booking was cancelled. Refund: ₹X"
  * "Your appointment at [Shop] is in 1 hour" *(+ TTS Voice)*
  * "Your appointment at [Shop] is in 30 minutes" *(+ TTS Voice)*
  * "How was your experience at [Shop]? Rate now"
* **Vendor Messages:**
  * "New booking from [Customer] for [Service] at [Time]" *(+ Un-mutable 10s TTS Voice/Sound)*
  * "[Customer] cancelled [Time] booking"
  * "Warning: [X] cancellations this week"
  * "Your account has been suspended. Reason: [reason]"
  * "Your account has been reactivated"

## 14. What's NOT Included (MVP Exclusions & Phase 2)
* **Do NOT Build in MVP:** Social login (Google/FB), User profile photo, Map view (Google Maps API), Reschedule booking, App Add to Calendar, In-app vendor contact, Wallet add/withdraw/expiry, Separate barber rating, Photo in review, Vendor review response, SMS/Email/WhatsApp alerts, Service images/variants, Weekly schedule templates, Custom slot block ranges, Revenue/Performance analytics charts, Export data, Association CRUD, Custom admin permissions.
* **Phase 2 Context (Future):** Loyalty/Reward points, Google Maps integration, Hindi Language, Advanced Analytics, Individual Barber Ratings.

## 15. Open Decisions & Configurations
* **System Config Defaults (`systemConfig` collection - DO NOT HARDCODE):**
  * `booking.advanceAmount` (10)
  * `booking.minBufferMinutes` (30)
  * `booking.appointmentBufferMinutes` (5)
  * `booking.slotIntervalMinutes` (15)
  * `booking.slotLockMinutes` (5)
  * `cancellation.userFreeWindowMinutes` (30)
  * `cancellation.userLateFeePercentage` (50)
  * `cancellation.userLifetimeLimit` (10)
  * `cancellation.vendorWeeklyLimit` (5)
  * `revenue.associationSharePerBooking` (2)
  * `limits.maxPhotosPerShop` (10)
  * `limits.maxServicesPerShop` (50)
  * `limits.maxBarbersPerShop` (20)
* **Not Yet Decided:** Independent vendor registration fee (₹500/₹1000?), Wallet balance expiry (No expiry for MVP), Review edit/delete (Disallowed for MVP).
