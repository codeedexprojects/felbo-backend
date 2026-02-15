# Felbo - Complete Project Context Document

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Model](#2-business-model)
3. [Technical Stack](#3-technical-stack)
4. [User Roles](#4-user-roles)
5. [Core Business Rules](#5-core-business-rules)
6. [User App Features](#6-user-app-features)
7. [Vendor App Features](#7-vendor-app-features)
8. [Admin Panel Features](#8-admin-panel-features)
9. [Database Design](#9-database-design)
10. [Key Flows](#10-key-flows)
11. [Validations & Error Messages](#11-validations--error-messages)
12. [Screen States](#12-screen-states)
13. [Notifications](#13-notifications)
14. [What's NOT Included (MVP Scope)](#14-whats-not-included-mvp-scope)
15. [Open Decisions & Configurations](#15-open-decisions--configurations)

---

## 1. Project Overview

### What is Felbo?

Felbo is a **same-day haircut booking platform** for Kerala barbershops. Users discover nearby salons, book appointments, pay ₹10 advance online, and pay the remaining amount at the shop.

### Key Characteristics

| Aspect            | Details                                    |
| ----------------- | ------------------------------------------ |
| Target Market     | Kerala, India                              |
| Primary Users     | People looking for haircuts/salon services |
| Vendors           | Local barbershops and salons               |
| Booking Type      | Same-day only (no advance booking)         |
| Revenue Model     | ₹10 advance per booking                    |
| Association Model | Kerala Barbers Association partnership     |

### Scale Expectations

| Metric         | Month 1  | Month 6  |
| -------------- | -------- | -------- |
| Vendors        | 4,000    | 35,000   |
| Daily Bookings | 40,000   | 200,000+ |
| Users          | 100,000+ | 500,000+ |

---

## 2. Business Model

### Revenue Structure

| Source                          | Amount                                    | Who Pays                     |
| ------------------------------- | ----------------------------------------- | ---------------------------- |
| Booking Advance                 | ₹10 per booking                           | User                         |
| Association Share               | ₹2 per booking (from association vendors) | Platform pays to Association |
| Independent Vendor Registration | One-time fee (₹XXX)                       | Vendor                       |
| Association Vendor Registration | Free                                      | -                            |

### Payment Flow

```
User books appointment
    │
    ▼
User pays ₹10 advance (Razorpay or Wallet)
    │
    ▼
₹10 goes to Platform (Super Admin)
    │
    ▼
User visits shop, pays remaining amount directly to vendor
    │
    ▼
End of month: Platform pays ₹2 per booking to Association
(for bookings from association member vendors only)
```

### Association Revenue Tracking

- Platform tracks bookings from association member vendors
- ₹2 per completed booking owed to association
- Super Admin manually pays association end of month
- System tracks: owed amount, paid amount, payment history

---

## 3. Technical Stack

| Component                   | Technology                                 |
| --------------------------- | ------------------------------------------ |
| Mobile Apps (User & Vendor) | Flutter                                    |
| Backend                     | Node.js / Express                          |
| Admin Panel                 | React.js                                   |
| Database                    | MongoDB                                    |
| Hosting                     | AWS                                        |
| Payment Gateway             | Razorpay                                   |
| Push Notifications          | Firebase Cloud Messaging (FCM)             |
| Languages                   | English + Malayalam (MVP), Hindi (Phase 2) |

### Architecture Decisions

| Decision                     | Rationale                                                  |
| ---------------------------- | ---------------------------------------------------------- |
| Monolith (not microservices) | 40K bookings/day manageable, simpler deployment            |
| 2-3 Node.js instances        | Behind load balancer, sufficient for scale                 |
| Redis                        | Caching, session management                                |
| Bull                         | Background job processing                                  |
| No Kubernetes                | Overkill until 500K+ bookings/day                          |
| No SMS                       | Cost saving, push notifications only                       |
| No Google Maps API           | Cost saving, just store coordinates and calculate distance |

---

## 4. User Roles

| Role              | Platform   | Description                                                        |
| ----------------- | ---------- | ------------------------------------------------------------------ |
| User              | Mobile App | Books appointments                                                 |
| Vendor            | Mobile App | Shop owner, manages shop and barbers                               |
| Barber            | -          | Employee under vendor (managed via Vendor app, not separate login) |
| Super Admin       | Web Panel  | Full platform access including revenue                             |
| Sub Admin         | Web Panel  | Full access except financial data                                  |
| Association Admin | Web Panel  | Only their vendors' data and revenue share                         |

### Admin Role Permissions

| Feature                       | Super Admin | Sub Admin       | Association Admin |
| ----------------------------- | ----------- | --------------- | ----------------- |
| Dashboard (all data)          | ✅          | ✅ (no revenue) | ❌                |
| Dashboard (filtered)          | ✅          | ✅              | ✅                |
| Vendor Management (all)       | ✅          | ✅              | ❌                |
| Vendor Management (filtered)  | ✅          | ✅              | ✅ (view only)    |
| Vendor Verification           | ✅          | ✅              | ❌                |
| User Management               | ✅          | ✅              | ❌                |
| Booking Management (all)      | ✅          | ✅              | ❌                |
| Booking Management (filtered) | ✅          | ✅              | ✅ (view only)    |
| Issue Management              | ✅          | ✅              | ❌                |
| Revenue Reports               | ✅          | ❌              | ❌                |
| Association Revenue View      | ❌          | ❌              | ✅ (own share)    |
| Association Payout Tracking   | ✅          | ❌              | ❌                |
| Cancellation Management       | ✅          | ✅              | ❌                |
| System Configuration          | ✅          | ❌              | ❌                |
| Admin Management              | ✅          | ❌              | ❌                |

---

## 5. Core Business Rules

### Booking Rules

| Rule                                | Value                                  | Configurable |
| ----------------------------------- | -------------------------------------- | ------------ |
| Booking window                      | Same-day only                          | No           |
| Minimum booking buffer              | 30 minutes from now                    | Yes          |
| Slot interval display               | 15 minutes                             | Yes          |
| Buffer between appointments         | 5 minutes                              | Yes          |
| Slot lock duration (during payment) | 5 minutes                              | Yes          |
| Advance amount                      | ₹10                                    | Yes          |
| Booking confirmation                | Auto-confirm (no vendor accept/reject) | No           |

### Cancellation Rules

| Scenario                            | Refund     | Destination             |
| ----------------------------------- | ---------- | ----------------------- |
| User cancels > 30 min after booking | ₹10 (100%) | Wallet                  |
| User cancels < 30 min after booking | ₹5 (50%)   | Wallet                  |
| Vendor cancels                      | ₹10 (100%) | Original payment method |
| User no-show                        | ₹0         | -                       |
| User reports issue (valid)          | ₹10 (100%) | Original payment method |

### Cancellation Limits

| Entity | Limit       | Consequence                                  |
| ------ | ----------- | -------------------------------------------- |
| User   | 10 lifetime | Cannot cancel anymore (must contact support) |
| Vendor | 5 per week  | Flagged for admin review                     |

### Wallet Rules

| Rule               | Details                                      |
| ------------------ | -------------------------------------------- |
| Wallet type        | Platform credit only                         |
| Add money          | Not supported                                |
| Withdraw money     | Not supported                                |
| Transfer to others | Not supported                                |
| Expiry             | Not in MVP                                   |
| Usage              | Auto-apply if balance >= ₹10                 |
| Partial payment    | Not supported (full wallet or full Razorpay) |

### Vendor Registration

| Type               | Fee           | Verification                           |
| ------------------ | ------------- | -------------------------------------- |
| Association Member | Free          | Manual admin verification of member ID |
| Independent Vendor | One-time paid | Light document verification            |

### Shop Types

| Type   | Description            |
| ------ | ---------------------- |
| MENS   | Men's salon/barbershop |
| WOMENS | Women's salon          |
| UNISEX | Both men and women     |

### Barber-Vendor Relationship

- Vendor (shop owner) can add themselves as a barber
- No separate barber login - managed through vendor app
- If owner is also barber, they create a barber profile for themselves

---

## 6. User App Features

### 1. Authentication & Account

**1.1 Registration**

| Feature            | Description                      | Details                             |
| ------------------ | -------------------------------- | ----------------------------------- |
| Phone Registration | User registers with phone number | 10-digit Indian mobile number       |
| OTP Verification   | Verify phone via OTP             | 6-digit OTP, 60 second resend timer |
| Basic Profile      | Collect basic info after OTP     | Name (required), Email (optional)   |

**1.2 Login**

| Feature            | Description                 | Details                              |
| ------------------ | --------------------------- | ------------------------------------ |
| Phone Login        | Login with registered phone | OTP-based, no password               |
| Session Management | Stay logged in              | Auto-logout after 30 days inactivity |

**1.3 Profile Management**

| Feature      | Description          | Details                                      |
| ------------ | -------------------- | -------------------------------------------- |
| View Profile | See own profile info | Name, phone, email                           |
| Edit Profile | Update profile info  | Can change name, email. Cannot change phone. |
| Logout       | Sign out of app      | Clears session, returns to login             |

---

### 2. Shop Discovery

**2.1 Location**

| Feature             | Description                    | Details                           |
| ------------------- | ------------------------------ | --------------------------------- |
| Auto Location       | Detect user's current location | GPS permission required           |
| Location Permission | Handle permission denied       | Show message, allow manual search |

**2.2 Shop Listing**

| Feature            | Description                        | Details                                         |
| ------------------ | ---------------------------------- | ----------------------------------------------- |
| Nearby Shops       | List shops sorted by distance      | Shows closest first                             |
| Shop Card          | Basic shop info in list            | Shop name, distance, rating, open/closed status |
| Distance Display   | Show how far shop is               | "1.2 km away"                                   |
| Open/Closed Status | Show if shop is accepting bookings | Based on today's availability                   |

**2.3 Search**

| Feature        | Description           | Details                       |
| -------------- | --------------------- | ----------------------------- |
| Search by Name | Find shop by name     | Text search                   |
| Search by Area | Find shops in an area | Text search for locality/area |

**2.4 Filters**

| Feature                | Description                              | Details                      |
| ---------------------- | ---------------------------------------- | ---------------------------- |
| Filter by Rating       | Show only highly rated shops             | 4+ stars, 3+ stars           |
| Filter by Service      | Show shops offering specific service     | Haircut, Shave, Facial, etc. |
| Filter by Availability | Show only shops with slots available now | "Available Now" filter       |
| Filter by Shop Type    | Filter by men's/women's/unisex           | Dropdown                     |

---

### 3. Shop Details

**3.1 Shop Information**

| Feature       | Description          | Details             |
| ------------- | -------------------- | ------------------- |
| Shop Name     | Display shop name    | Text                |
| Shop Type     | Men's/Women's/Unisex | Badge               |
| Shop Address  | Full address         | Text, not clickable |
| Distance      | How far from user    | "1.2 km away"       |
| Rating        | Average rating       | X.X out of 5 stars  |
| Review Count  | Number of reviews    | "124 reviews"       |
| Working Hours | Today's hours        | "Open 9 AM - 8 PM"  |
| Shop Photos   | Gallery of shop      | Swipeable images    |
| Favorite Icon | Save to favorites    | Heart icon          |

**3.2 Services List**

| Feature          | Description       | Details                                  |
| ---------------- | ----------------- | ---------------------------------------- |
| Service Name     | Name of service   | Haircut, Shave, etc.                     |
| Service Category | Category grouping | Hair, Beard, Face, etc.                  |
| Service Price    | Cost of service   | ₹XXX                                     |
| Service Duration | Time required     | "20-30 mins" (range if varies by barber) |

**3.3 Barbers List**

| Feature             | Description               | Details                              |
| ------------------- | ------------------------- | ------------------------------------ |
| Barber Name         | Name of barber            | Text                                 |
| Barber Photo        | Profile photo             | Image or placeholder                 |
| Barber Rating       | Individual rating         | X.X stars                            |
| Availability Status | Is barber available today | "Available" or "Not Available Today" |

**3.4 Reviews**

| Feature        | Description           | Details                 |
| -------------- | --------------------- | ----------------------- |
| Review List    | Past customer reviews | Rating + comment + date |
| Review Count   | Total reviews         | Number                  |
| Average Rating | Calculated average    | X.X stars               |

---

### 4. Booking Flow

**4.1 Service Selection**

| Feature            | Description                      | Details                      |
| ------------------ | -------------------------------- | ---------------------------- |
| View Services      | See all services shop offers     | List with price and duration |
| Select Services    | Choose one or more services      | Multi-select with checkboxes |
| Service Total      | Show combined price and duration | "Total: ₹150, ~45 mins"      |
| Service Validation | At least one service required    | Error if none selected       |

**4.2 Barber Selection**

| Feature              | Description                                    | Details                                         |
| -------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Any Available Option | Let system assign barber                       | "Any Available" as first option                 |
| Specific Barber      | Choose preferred barber                        | List of available barbers                       |
| Barber Filtering     | Show only barbers who can do selected services | Disabled barbers shown as "Cannot do [service]" |
| Duration per Barber  | Show barber's duration for selected services   | "35 mins with Vijay"                            |

**4.3 Time Slot Selection**

| Feature           | Description               | Details                                                        |
| ----------------- | ------------------------- | -------------------------------------------------------------- |
| Date Selection    | Today only                | Single option: "Today"                                         |
| Available Slots   | Show bookable time slots  | Based on barber availability, existing bookings, blocked slots |
| Slot Grouping     | Group by time of day      | Morning, Afternoon, Evening                                    |
| Unavailable Slots | Show why slot unavailable | Greyed out                                                     |
| Slot Interval     | Time between slot options | 15 minute intervals                                            |
| Minimum Buffer    | Earliest bookable slot    | 30 minutes from now                                            |

**4.4 Booking Summary**

| Feature          | Description                     | Details                             |
| ---------------- | ------------------------------- | ----------------------------------- |
| Summary Screen   | Review before payment           | Shop, barber, services, time        |
| Price Breakdown  | Show all costs                  | Service total, advance amount (₹10) |
| Remaining Amount | Amount to pay at shop           | Service total minus ₹10             |
| Wallet Balance   | Show if user has wallet balance | "Wallet: ₹20"                       |
| Apply Wallet     | Option to use wallet            | Checkbox or toggle                  |

**4.5 Payment**

| Feature            | Description              | Details                      |
| ------------------ | ------------------------ | ---------------------------- |
| Wallet Payment     | Pay using wallet balance | If balance >= ₹10            |
| Razorpay Payment   | Pay using UPI/Card       | If wallet insufficient       |
| Payment Processing | Show loading state       | "Processing payment…"        |
| Payment Success    | Confirm payment done     | Proceed to confirmation      |
| Payment Failure    | Handle failed payment    | Show error, allow retry      |
| Slot Lock          | Prevent double booking   | 5 minute lock during payment |

**4.6 Booking Confirmation**

| Feature             | Description            | Details                             |
| ------------------- | ---------------------- | ----------------------------------- |
| Confirmation Screen | Show booking confirmed | Booking ID, details                 |
| Booking ID          | Unique identifier      | "FLB12345"                          |
| Booking Details     | All booking info       | Shop, barber, service, time, amount |
| Next Steps          | What user should do    | "Pay ₹XXX at shop"                  |

---

### 5. Booking Management

**5.1 My Bookings**

| Feature           | Description                | Details                          |
| ----------------- | -------------------------- | -------------------------------- |
| Upcoming Bookings | List of confirmed bookings | Today's bookings only            |
| Past Bookings     | Booking history            | Last 30 days                     |
| Booking Card      | Basic booking info         | Shop name, service, time, status |

**5.2 Booking Details**

| Feature        | Description                  | Details                         |
| -------------- | ---------------------------- | ------------------------------- |
| Full Details   | Complete booking information | All fields from confirmation    |
| Booking Status | Current status               | Confirmed, Completed, Cancelled |
| Shop Address   | Where to go                  | Text address                    |

**5.3 Cancel Booking**

| Feature                       | Description           | Details                            |
| ----------------------------- | --------------------- | ---------------------------------- |
| Cancel Button                 | Option to cancel      | Available for confirmed bookings   |
| Cancellation Rules            | Show refund policy    | Based on time since booking        |
| Cancel > 30 min after booking | Full refund to wallet | ₹10 to wallet                      |
| Cancel < 30 min after booking | Partial refund        | ₹5 to wallet (50% fee)             |
| Cancellation Confirmation     | Confirm cancellation  | "Are you sure?"                    |
| Cancellation Success          | Show result           | "Cancelled. ₹X refunded to wallet" |
| Lifetime Limit                | Maximum cancellations | 10 lifetime, then cannot cancel    |

**5.4 Report Issue**

| Feature          | Description                 | Details                                                  |
| ---------------- | --------------------------- | -------------------------------------------------------- |
| Report Button    | Report problem with booking | Available around appointment time                        |
| Issue Types      | Select type of issue        | Shop closed, Barber not available, Excessive wait, Other |
| Location Check   | Verify user is at shop      | Must be within 500m                                      |
| Time Check       | Verify timing               | Within ±30 mins of booking time                          |
| Issue Submission | Submit report               | Goes to admin for review                                 |
| Auto Refund      | Refund for valid issues     | ₹10 to original payment method                           |

---

### 6. Wallet

**6.1 Wallet Balance**

| Feature         | Description                | Details                           |
| --------------- | -------------------------- | --------------------------------- |
| View Balance    | See current wallet balance | ₹XX                               |
| Balance Display | Show balance in app        | On home screen and booking screen |

**6.2 Transaction History**

| Feature             | Description             | Details                               |
| ------------------- | ----------------------- | ------------------------------------- |
| Transaction List    | All wallet transactions | Credits and debits                    |
| Transaction Details | Each transaction info   | Type, amount, date, booking reference |
| Transaction Types   | Credit or debit         | Refund (credit), Payment (debit)      |

**6.3 Wallet Usage**

| Feature           | Description             | Details                                      |
| ----------------- | ----------------------- | -------------------------------------------- |
| Auto-Apply Option | Use wallet for bookings | Toggle on booking screen                     |
| Partial Usage     | Use wallet + Razorpay   | Not supported. Wallet only if balance >= ₹10 |

---

### 7. Ratings & Reviews

**7.1 Post-Booking Review**

| Feature        | Description                            | Details                            |
| -------------- | -------------------------------------- | ---------------------------------- |
| Review Prompt  | Ask for review after booking completed | Push notification or in-app prompt |
| Star Rating    | Rate the experience                    | 1-5 stars (required)               |
| Written Review | Optional comment                       | Text, max 500 characters           |
| Submit Review  | Save review                            | One review per booking             |

**7.2 Review Rules**

| Feature                | Description                      | Details           |
| ---------------------- | -------------------------------- | ----------------- |
| One Review Per Booking | Cannot review same booking twice | Enforced          |
| Auto-linked            | Review linked to shop and barber | From booking data |
| Edit Review            | Modify submitted review          | Not allowed       |
| Delete Review          | Remove review                    | Not allowed       |

---

### 8. Notifications

**8.1 Push Notifications**

| Feature            | Description             | Details                                       |
| ------------------ | ----------------------- | --------------------------------------------- |
| Booking Confirmed  | When booking successful | "Booking confirmed at [Shop] for [Time]"      |
| Booking Cancelled  | When booking cancelled  | "Your booking was cancelled. Refund: ₹X"      |
| Reminder (1 hour)  | Before appointment      | "Your appointment is in 1 hour"               |
| Reminder (30 min)  | Before appointment      | "Your appointment is in 30 minutes"           |
| Review Request     | After service           | "How was your experience? Rate now"           |
| Notification Sound | Custom sound            | 10 seconds, different for booking vs reminder |

---

### 9. Favorite Shops

**9.1 Add/Remove Favorites**

| Feature               | Description                          | Details                             |
| --------------------- | ------------------------------------ | ----------------------------------- |
| Add to Favorites      | Save shop from shop details          | Tap heart icon                      |
| Remove from Favorites | Remove from favorites                | Tap filled heart icon               |
| Favorite Icon         | Heart icon on shop cards and details | Outline = not saved, Filled = saved |

**9.2 Favorites List**

| Feature            | Description                    | Details                             |
| ------------------ | ------------------------------ | ----------------------------------- |
| View Favorites     | List all saved shops           | Accessible from profile/menu        |
| Favorite Shop Card | Basic shop info                | Shop name, distance, rating, status |
| Unavailable Shop   | Shop inactive but in favorites | Shows "Currently Unavailable" badge |

---

### 10. Voice Notifications

**10.1 Reminder Alerts**

| Feature          | Description                       | Details                                   |
| ---------------- | --------------------------------- | ----------------------------------------- |
| Reminder Sound   | Custom sound for booking reminder | Plays on notification                     |
| Voice Readout    | TTS reads reminder details        | Only when app is open/background          |
| Reminder Content | What is spoken                    | "Your appointment at [Shop] is in [Time]" |

**10.2 Voice Settings**

| Feature              | Description                | Details         |
| -------------------- | -------------------------- | --------------- |
| Enable/Disable Voice | Toggle voice announcements | In app settings |
| Default State        | Voice enabled by default   | ON              |

---

## 7. Vendor App Features

### 1. Authentication & Registration

**1.1 Registration**

| Feature            | Description                 | Details                        |
| ------------------ | --------------------------- | ------------------------------ |
| Phone Registration | Vendor registers with phone | 10-digit Indian mobile number  |
| OTP Verification   | Verify phone via OTP        | 6-digit OTP                    |
| Basic Info         | Collect vendor/shop info    | Owner name, shop name, address |

**1.2 Registration Type Selection**

| Feature            | Description                               | Details            |
| ------------------ | ----------------------------------------- | ------------------ |
| Association Member | Free registration for association members | Requires member ID |
| Independent Vendor | Paid registration                         | One-time fee       |

**1.3 Association Member Flow**

| Feature                 | Description                   | Details                      |
| ----------------------- | ----------------------------- | ---------------------------- |
| Enter Member ID         | Association membership number | Text input                   |
| Upload ID Proof         | Photo of association card     | Camera or gallery            |
| Submit for Verification | Send to admin                 | Status: Pending Verification |
| Verification Status     | Track approval                | Pending, Approved, Rejected  |
| Rejection Reason        | Why rejected (if applicable)  | Shown to vendor              |

**1.4 Independent Vendor Flow**

| Feature              | Description            | Details                       |
| -------------------- | ---------------------- | ----------------------------- |
| Upload Documents     | Shop license, owner ID | Camera or gallery             |
| Pay Registration Fee | One-time payment       | ₹XXX via Razorpay             |
| Payment Confirmation | Fee received           | Proceed to light verification |
| Verification         | Document check         | Faster than association       |

**1.5 Login**

| Feature            | Description                 | Details                   |
| ------------------ | --------------------------- | ------------------------- |
| Phone Login        | Login with registered phone | OTP-based                 |
| Session Management | Stay logged in              | Auto-logout after 30 days |

---

### 2. Shop Profile Management

**2.1 Shop Information**

| Feature              | Description          | Details                                             |
| -------------------- | -------------------- | --------------------------------------------------- |
| Shop Name            | Business name        | Editable                                            |
| Shop Type            | Men's/Women's/Unisex | Dropdown selection                                  |
| Owner Name           | Owner's name         | Editable                                            |
| Phone Number         | Contact number       | From registration, not editable, not shown to users |
| Address              | Shop location        | Text address, editable                              |
| Location Coordinates | GPS position         | Auto-detect or manual entry                         |

**2.2 Shop Photos**

| Feature       | Description          | Details               |
| ------------- | -------------------- | --------------------- |
| Add Photos    | Upload shop images   | Camera or gallery     |
| Photo Gallery | View uploaded photos | Swipeable             |
| Delete Photo  | Remove photo         | Confirm before delete |
| Photo Limit   | Maximum photos       | 10 photos             |

**2.3 Working Hours**

| Feature           | Description                | Details                 |
| ----------------- | -------------------------- | ----------------------- |
| Set Working Hours | Daily open/close time      | Per day or same for all |
| Holiday           | Mark shop closed for a day | Select date             |

---

### 3. Service Management

**3.1 Add Service**

| Feature             | Description           | Details                |
| ------------------- | --------------------- | ---------------------- |
| Service Name        | Name of service       | Text, required         |
| Service Category    | Category for grouping | Select from categories |
| Service Price       | Cost                  | Number, required       |
| Service Description | Optional details      | Text, optional         |
| Applicable For      | Gender applicability  | Male, Female, All      |

**3.2 Service Categories**

| Feature           | Description              | Details                              |
| ----------------- | ------------------------ | ------------------------------------ |
| System Categories | Pre-defined categories   | Hair, Beard, Face, Spa, Combo, Other |
| Custom Categories | Shop-specific categories | Vendor can add own categories        |

**3.3 Service List**

| Feature                | Description            | Details                                       |
| ---------------------- | ---------------------- | --------------------------------------------- |
| View All Services      | List of shop services  | Name, price, category                         |
| Edit Service           | Modify service details | All fields editable                           |
| Delete Service         | Remove service         | Confirm. Cannot delete if barber assigned.    |
| Enable/Disable Service | Temporarily turn off   | Toggle. Disabled services not shown to users. |

---

### 4. Barber Management

**4.1 Add Barber**

| Feature      | Description     | Details                     |
| ------------ | --------------- | --------------------------- |
| Barber Name  | Employee name   | Text, required              |
| Barber Phone | Contact number  | 10-digit, required          |
| Barber Photo | Profile picture | Camera or gallery, optional |

**4.2 Barber List**

| Feature               | Description            | Details                                        |
| --------------------- | ---------------------- | ---------------------------------------------- |
| View All Barbers      | List of barbers        | Name, photo, status                            |
| Edit Barber           | Modify barber details  | Name, phone, photo                             |
| Delete Barber         | Remove barber          | Confirm. Cannot delete if has future bookings. |
| Enable/Disable Barber | Temporarily deactivate | Toggle                                         |

**4.3 Assign Services to Barber**

| Feature              | Description                             | Details                         |
| -------------------- | --------------------------------------- | ------------------------------- |
| Service Assignment   | Which services barber can do            | Multi-select from shop services |
| Duration per Service | Barber's time for each service          | Number in minutes               |
| Price per Service    | Barber's price (if different from shop) | Optional override               |

**4.4 Default Service**

| Feature             | Description                    | Details                 |
| ------------------- | ------------------------------ | ----------------------- |
| Set Default Service | Most common service for barber | For quick block feature |

---

### 5. Daily Availability

**5.1 Set Today's Availability**

| Feature          | Description            | Details                      |
| ---------------- | ---------------------- | ---------------------------- |
| Is Working Today | Toggle for each barber | Yes/No                       |
| Working Hours    | Start and end time     | Time pickers                 |
| Break Time       | Add break periods      | Start time, end time, reason |
| Multiple Breaks  | More than one break    | Add additional breaks        |

**5.2 Availability Rules**

| Feature          | Description                   | Details                |
| ---------------- | ----------------------------- | ---------------------- |
| Daily Setup      | Set availability each morning | Recommended at 8:30 AM |
| Default Hours    | Copy from shop working hours  | Auto-fill option       |
| No Advance Setup | Cannot set for future days    | Same-day only          |

**5.3 Half-Day Leave (Emergency)**

| Feature             | Description                     | Details             |
| ------------------- | ------------------------------- | ------------------- |
| Mark Early Leave    | Barber leaving early            | Select leave time   |
| Affected Bookings   | Show bookings after leave time  | List                |
| Manual Cancellation | Vendor must cancel each booking | One by one          |
| Refund              | Full refund to original payment | Vendor cancellation |

---

### 6. Booking Management

**6.1 Today's Bookings**

| Feature          | Description                      | Details                              |
| ---------------- | -------------------------------- | ------------------------------------ |
| Booking List     | All confirmed bookings for today | Sorted by time                       |
| Booking Card     | Basic info                       | Customer name, service, time, status |
| Filter by Barber | See specific barber's bookings   | Dropdown filter                      |
| Filter by Status | See by status                    | All, Confirmed, Completed, Cancelled |

**6.2 Booking Details**

| Feature          | Description       | Details                         |
| ---------------- | ----------------- | ------------------------------- |
| Customer Name    | Who booked        | From user profile               |
| Customer Phone   | Contact number    | Tap to call                     |
| Service          | What they booked  | Service name(s)                 |
| Time             | Appointment time  | Start time                      |
| Duration         | How long          | Total minutes                   |
| Barber           | Assigned barber   | Barber name                     |
| Advance Paid     | Amount received   | ₹10                             |
| Remaining Amount | Amount to collect | Total - ₹10                     |
| Booking Status   | Current status    | Confirmed, Completed, Cancelled |

**6.3 Mark as Complete**

| Feature                 | Description        | Details                     |
| ----------------------- | ------------------ | --------------------------- |
| Complete Button         | Mark service done  | On booking details screen   |
| Completion Confirmation | Confirm completion | Updates status to Completed |

**6.4 Cancel Booking (Vendor)**

| Feature                   | Description       | Details                                                                |
| ------------------------- | ----------------- | ---------------------------------------------------------------------- |
| Cancel Button             | Cancel booking    | On booking details screen                                              |
| Cancellation Reason       | Why cancelling    | Required: Barber sick, Emergency, Shop closing, Equipment issue, Other |
| Cancellation Warning      | Show consequences | "Customer will be refunded. This affects your cancellation rate."      |
| Cancellation Confirmation | Confirm cancel    | Refund initiated to customer's original payment method                 |

**6.5 Booking Notifications**

| Feature              | Description            | Details                                   |
| -------------------- | ---------------------- | ----------------------------------------- |
| New Booking Alert    | When new booking comes | Push notification with sound (10 seconds) |
| Notification Content | What's shown           | Customer name, service, time              |
| Sound                | Cannot be disabled     | Intentional - vendor must hear bookings   |

---

### 7. Walk-in Management (Slot Blocking)

**7.1 Quick Block**

| Feature            | Description          | Details                                  |
| ------------------ | -------------------- | ---------------------------------------- |
| Quick Block Button | One-tap slot block   | Prominent on dashboard                   |
| Default Service    | Pre-selected service | Vendor can set default per barber        |
| Block Duration     | Auto-calculated      | Based on service duration + 5 min buffer |
| Block Start Time   | When block starts    | Current time (NOW)                       |

**7.2 Set Default Service**

| Feature                 | Description          | Details            |
| ----------------------- | -------------------- | ------------------ |
| Default Service Setting | Most common service  | In barber settings |
| Purpose                 | Pre-fill quick block | Reduces taps       |

---

### 8. Dashboard & Reports

**8.1 Today's Dashboard**

| Feature                  | Description               | Details                 |
| ------------------------ | ------------------------- | ----------------------- |
| Today's Bookings Count   | Total bookings today      | Number                  |
| Completed Count          | Finished services         | Number                  |
| Upcoming Count           | Still to come             | Number                  |
| Today's Revenue (Online) | Advance payments received | ₹XX (from ₹10 advances) |

**8.2 Booking History**

| Feature          | Description          | Details      |
| ---------------- | -------------------- | ------------ |
| Past Bookings    | Previous bookings    | Last 30 days |
| Filter by Date   | Select date range    | Date picker  |
| Filter by Status | Completed, Cancelled | Dropdown     |

---

### 9. Settings

**9.1 Account Settings**

| Feature      | Description         | Details                         |
| ------------ | ------------------- | ------------------------------- |
| View Profile | Shop and owner info | Read-only summary               |
| Edit Profile | Modify info         | Opens profile management        |
| Change Phone | Update phone number | OTP verification for new number |
| Logout       | Sign out            | Confirm before logout           |

**9.2 App Settings**

| Feature  | Description  | Details            |
| -------- | ------------ | ------------------ |
| Language | App language | English, Malayalam |

---

### 10. Vendor Notifications

**10.1 Push Notifications**

| Feature              | Description            | Details                                             |
| -------------------- | ---------------------- | --------------------------------------------------- |
| New Booking          | When customer books    | "New booking: [Service] at [Time]"                  |
| Booking Cancelled    | When customer cancels  | "[Customer] cancelled [Time] booking"               |
| Cancellation Warning | High cancellation rate | "Warning: [X] cancellations this week"              |
| Account Blocked      | Suspended by admin     | "Your account has been suspended. Reason: [reason]" |
| Account Unblocked    | Reactivated            | "Your account has been reactivated"                 |

---

### 11. Voice Notifications

**11.1 Booking Alerts**

| Feature        | Description                  | Details                                               |
| -------------- | ---------------------------- | ----------------------------------------------------- |
| Booking Sound  | Custom sound for new booking | 10 seconds, loud/distinct                             |
| Voice Readout  | TTS reads booking details    | Only when app is open/background                      |
| Voice Content  | What is spoken               | "New booking from [Customer] for [Service] at [Time]" |
| Cannot Disable | Sound always on              | Intentional                                           |

---

## 8. Admin Panel Features

### 1. Authentication

| Feature              | Description    | Details                     |
| -------------------- | -------------- | --------------------------- |
| Email/Password Login | Admin signs in | Standard login              |
| Forgot Password      | Reset password | Email-based reset           |
| Session Timeout      | Auto logout    | After 8 hours of inactivity |

---

### 2. Dashboard

**2.1 Super Admin Dashboard**

| Feature               | Description                | Details             |
| --------------------- | -------------------------- | ------------------- |
| Total Users           | Registered users count     | All time            |
| Total Vendors         | Registered vendors count   | All time            |
| Total Bookings        | All bookings count         | All time            |
| Today's Bookings      | Today's count              | Number              |
| Today's Revenue       | Platform earnings today    | Sum of ₹10 advances |
| Pending Verifications | Vendors awaiting approval  | Number with link    |
| Recent Issues         | User-reported problems     | List with status    |
| Association Dues      | Amount owed to association | Current month       |

**2.2 Sub Admin Dashboard**

| Feature               | Description               | Details          |
| --------------------- | ------------------------- | ---------------- |
| Total Users           | Registered users count    | All time         |
| Total Vendors         | Registered vendors count  | All time         |
| Total Bookings        | All bookings count        | All time         |
| Today's Bookings      | Today's count             | Number           |
| Pending Verifications | Vendors awaiting approval | Number with link |
| Recent Issues         | User-reported problems    | List with status |

_Cannot see: Revenue, Association Dues_

**2.3 Association Admin Dashboard**

| Feature             | Description                       | Details         |
| ------------------- | --------------------------------- | --------------- |
| My Vendors Count    | Vendors in their association      | Number          |
| My Vendors Bookings | Bookings for their vendors        | Today and total |
| My Revenue Share    | ₹2 per booking from their vendors | Current month   |
| Pending Payout      | Amount owed by platform           | Current month   |
| Payout History      | Past payouts                      | List            |

---

### 3. Vendor Management

**3.1 Vendor List**

| Feature          | Description                | Details    |
| ---------------- | -------------------------- | ---------- |
| All Vendors      | List of all vendors        | Table view |
| Search Vendor    | Find by name or phone      | Search box |
| Filter by Status | Active, Pending, Suspended | Dropdown   |
| Filter by Type   | Association, Independent   | Dropdown   |
| Vendor Count     | Total matching filter      | Number     |

**3.2 Vendor Details**

| Feature             | Description                | Details                |
| ------------------- | -------------------------- | ---------------------- |
| Shop Information    | All shop details           | Name, address, contact |
| Registration Type   | Association or Independent | Display                |
| Registration Date   | When registered            | Date                   |
| Verification Status | Current status             | Display                |
| Documents           | Uploaded documents         | View/download          |
| Barbers             | List of barbers            | Count and names        |
| Services            | List of services           | Count and names        |
| Bookings            | Recent bookings            | Last 10                |
| Cancellation Rate   | Vendor cancel percentage   | Calculated             |

**3.3 Vendor Verification**

| Feature          | Description                       | Details                  |
| ---------------- | --------------------------------- | ------------------------ |
| Pending Queue    | Vendors awaiting verification     | List                     |
| View Application | See submitted details             | All fields + documents   |
| Verify Member ID | Check against association records | Manual process           |
| Approve          | Activate vendor                   | Button                   |
| Reject           | Decline application               | Button + reason required |

**3.4 Vendor Actions**

| Feature       | Description                                 | Details               |
| ------------- | ------------------------------------------- | --------------------- |
| Activate      | Enable vendor                               | If suspended          |
| Suspend       | Disable vendor                              | With reason           |
| Block         | Block vendor (from cancellation management) | With reason           |
| Unblock       | Unblock vendor                              | Button                |
| View Bookings | See vendor's bookings                       | Link to filtered list |

---

### 4. User Management

**4.1 User List**

| Feature          | Description           | Details    |
| ---------------- | --------------------- | ---------- |
| All Users        | List of all users     | Table view |
| Search User      | Find by name or phone | Search box |
| Filter by Status | Active, Blocked       | Dropdown   |
| User Count       | Total matching filter | Number     |

**4.2 User Details**

| Feature            | Description                | Details |
| ------------------ | -------------------------- | ------- |
| User Information   | Name, phone, email         | Display |
| Registration Date  | When joined                | Date    |
| Wallet Balance     | Current balance            | Amount  |
| Booking History    | All bookings               | List    |
| Cancellation Count | Times cancelled (lifetime) | Number  |
| Issues Reported    | Problems reported          | List    |

**4.3 User Actions**

| Feature       | Description          | Details               |
| ------------- | -------------------- | --------------------- |
| Block User    | Disable user account | With reason           |
| Unblock User  | Re-enable user       | Button                |
| View Bookings | See user's bookings  | Link to filtered list |

---

### 5. Booking Management

**5.1 Booking List**

| Feature          | Description                          | Details     |
| ---------------- | ------------------------------------ | ----------- |
| All Bookings     | List of all bookings                 | Table view  |
| Search           | By booking ID, user phone, shop name | Search box  |
| Filter by Status | Confirmed, Completed, Cancelled      | Dropdown    |
| Filter by Date   | Date range                           | Date picker |
| Filter by Vendor | Specific vendor                      | Dropdown    |
| Booking Count    | Total matching filter                | Number      |

**5.2 Booking Details**

| Feature        | Description       | Details           |
| -------------- | ----------------- | ----------------- |
| Booking ID     | Unique identifier | Display           |
| User Details   | Name, phone       | Display           |
| Vendor Details | Shop name         | Display           |
| Barber         | Barber name       | Display           |
| Service        | What was booked   | List              |
| Time           | Appointment time  | Display           |
| Status         | Current status    | Display           |
| Payment        | Method and amount | Display           |
| Refund         | If applicable     | Status and amount |

**5.3 Booking Actions**

| Feature           | Description            | Details     |
| ----------------- | ---------------------- | ----------- |
| View Full Details | Complete booking info  | Detail page |
| Manual Refund     | Issue refund if needed | With reason |

---

### 6. Issue Management

**6.1 Issue List**

| Feature          | Description                           | Details    |
| ---------------- | ------------------------------------- | ---------- |
| All Issues       | User-reported problems                | Table view |
| Filter by Status | Open, Resolved, Rejected              | Dropdown   |
| Filter by Type   | Shop closed, Barber unavailable, etc. | Dropdown   |
| Issue Count      | Total matching filter                 | Number     |

**6.2 Issue Details**

| Feature            | Description       | Details     |
| ------------------ | ----------------- | ----------- |
| Booking Details    | Related booking   | Link        |
| User Details       | Who reported      | Name, phone |
| Vendor Details     | Which shop        | Name, phone |
| Issue Type         | What happened     | Display     |
| User Location      | Where they were   | Coordinates |
| Time Reported      | When reported     | Timestamp   |
| Photo Evidence     | If uploaded       | Image       |
| Auto-Refund Status | Was refund issued | Display     |

**6.3 Issue Actions**

| Feature        | Description    | Details            |
| -------------- | -------------- | ------------------ |
| Mark Resolved  | Close issue    | Button             |
| Reject Issue   | Invalid report | Button + reason    |
| Contact User   | Reach out      | Phone number       |
| Contact Vendor | Reach out      | Phone number       |
| Flag Vendor    | Add warning    | If vendor at fault |

---

### 7. Financial Management (Super Admin Only)

**7.1 Revenue Overview**

| Feature              | Description            | Details |
| -------------------- | ---------------------- | ------- |
| Today's Revenue      | ₹10 × today's bookings | Amount  |
| This Week's Revenue  | Last 7 days            | Amount  |
| This Month's Revenue | Current month          | Amount  |
| Total Revenue        | All time               | Amount  |

**7.2 Revenue Reports**

| Feature               | Description                | Details     |
| --------------------- | -------------------------- | ----------- |
| Daily Report          | Revenue by day             | Table/chart |
| Filter by Date Range  | Custom period              | Date picker |
| Filter by Vendor      | Specific vendor            | Dropdown    |
| Filter by Vendor Type | Association or Independent | Dropdown    |
| Export                | Download report            | CSV         |

**7.3 Refund Tracking**

| Feature          | Description                | Details                 |
| ---------------- | -------------------------- | ----------------------- |
| All Refunds      | List of refunds issued     | Table view              |
| Filter by Type   | To wallet, to original     | Dropdown                |
| Filter by Status | Completed, Pending, Failed | Dropdown                |
| Refund Details   | Full info                  | Amount, reason, booking |

**7.4 Association Payout Tracking**

| Feature           | Description                 | Details  |
| ----------------- | --------------------------- | -------- |
| Month Selection   | Select month to view/pay    | Dropdown |
| Bookings Count    | Association vendor bookings | Number   |
| Share Per Booking | ₹2                          | Display  |
| Total Share       | ₹2 × bookings               | Amount   |
| Payment Status    | Paid or Pending             | Status   |
| Mark as Paid      | Record manual payment       | Button   |
| Payment Notes     | Optional notes              | Text     |

**7.5 Payout History**

| Feature     | Description          | Details    |
| ----------- | -------------------- | ---------- |
| All Payouts | List of past payouts | Table view |
| Month       | Which month          | Display    |
| Amount      | How much paid        | Amount     |
| Paid On     | Date of payment      | Date       |
| Paid By     | Which admin          | Admin name |
| Notes       | Payment notes        | Display    |

---

### 8. Association Revenue View (Association Admin Only)

**8.1 My Revenue Share**

| Feature                | Description              | Details |
| ---------------------- | ------------------------ | ------- |
| Current Month Bookings | Bookings from my vendors | Count   |
| Revenue Share Rate     | Amount per booking       | ₹2      |
| Current Month Earnings | Total earned this month  | Amount  |
| Payment Status         | Paid or Pending          | Status  |

**8.2 Revenue History**

| Feature  | Description     | Details |
| -------- | --------------- | ------- |
| Month    | Which month     | Display |
| Bookings | Total bookings  | Number  |
| Earnings | ₹2 × bookings   | Amount  |
| Status   | Paid or Pending | Display |
| Paid On  | When received   | Date    |

---

### 9. Cancellation Management

**9.1 Cancellation Dashboard**

| Feature         | Description                          | Details              |
| --------------- | ------------------------------------ | -------------------- |
| Flagged Vendors | Vendors exceeding cancellation limit | Auto-flagged         |
| Alert Badge     | Count of flagged vendors             | Shown in sidebar     |
| Period Filter   | Filter by time range                 | Last 7 days, 30 days |

**9.2 Flagged Vendor List**

| Feature            | Description             | Details                    |
| ------------------ | ----------------------- | -------------------------- |
| Vendor Name        | Shop owner name         | Display                    |
| Shop Name          | Business name           | Display                    |
| Phone              | Contact number          | Display                    |
| Cancellation Count | Cancellations in period | Number                     |
| Cancellation Rate  | Percentage              | X%                         |
| Last Cancellation  | Most recent date        | Date                       |
| Status             | Current status          | Flagged, Reviewed, Blocked |

**9.3 Admin Actions**

| Feature        | Description       | Details         |
| -------------- | ----------------- | --------------- |
| Mark Reviewed  | Acknowledge flag  | Updates status  |
| Send Warning   | Notify vendor     | Manual message  |
| Block Vendor   | Disable account   | Requires reason |
| Unblock Vendor | Re-enable account | Button          |

---

### 10. System Configuration (Super Admin Only)

**10.1 Booking Settings**

| Setting                | Default | Description            |
| ---------------------- | ------- | ---------------------- |
| Advance Amount         | ₹10     | Booking advance fee    |
| Minimum Booking Buffer | 30 min  | Earliest slot from now |
| Appointment Buffer     | 5 min   | Gap between bookings   |
| Slot Interval          | 15 min  | Display interval       |
| Slot Lock Duration     | 5 min   | Lock during payment    |

**10.2 Cancellation Settings**

| Setting                    | Default | Description         |
| -------------------------- | ------- | ------------------- |
| Free Cancellation Window   | 30 min  | Full refund period  |
| Late Cancellation Fee      | 50%     | Percentage deducted |
| User Lifetime Cancel Limit | 10      | Max per user        |
| Vendor Weekly Cancel Limit | 5       | Max before flagged  |

**10.3 Revenue Settings**

| Setting                       | Default | Description        |
| ----------------------------- | ------- | ------------------ |
| Association Share Per Booking | ₹2      | Amount per booking |

**10.4 Limits**

| Setting               | Default | Description         |
| --------------------- | ------- | ------------------- |
| Max Photos Per Shop   | 10      | Maximum shop photos |
| Max Services Per Shop | 50      | Maximum services    |
| Max Barbers Per Shop  | 20      | Maximum barbers     |

---

### 11. Admin Management (Super Admin Only)

**11.1 Admin List**

| Feature          | Description                         | Details    |
| ---------------- | ----------------------------------- | ---------- |
| All Admins       | List of admin accounts              | Table view |
| Filter by Role   | Super Admin, Sub Admin, Association | Dropdown   |
| Filter by Status | Active, Inactive                    | Dropdown   |

**11.2 Create Admin**

| Feature          | Description    | Details          |
| ---------------- | -------------- | ---------------- |
| Name             | Admin name     | Required         |
| Email            | Login email    | Required, unique |
| Phone            | Contact number | Required         |
| Role             | Admin role     | Dropdown         |
| Initial Password | Set password   | Required         |

**11.3 Admin Actions**

| Feature        | Description          | Details           |
| -------------- | -------------------- | ----------------- |
| Edit Admin     | Modify details       | Name, phone, role |
| Deactivate     | Disable admin access | Button            |
| Activate       | Enable admin access  | Button            |
| Reset Password | Send password reset  | Email             |

---

## 9. Database Design

### Collections Overview

| Collection         | Purpose                                    |
| ------------------ | ------------------------------------------ |
| users              | Customer accounts                          |
| vendors            | Shop owner accounts                        |
| shops              | Shop/salon details                         |
| barbers            | Barbers working in shops                   |
| serviceCategories  | Categories for services                    |
| services           | Services offered by shops                  |
| barberServices     | Barber-service mapping with duration/price |
| barberAvailability | Daily availability per barber              |
| bookings           | All bookings                               |
| slotBlocks         | Walk-in blocked slots                      |
| slotLocks          | Temporary locks during payment (TTL)       |
| payments           | Payment records                            |
| walletTransactions | Wallet ledger                              |
| reviews            | User reviews                               |
| userFavorites      | User's favorite shops                      |
| bookingIssues      | User-reported problems                     |
| admins             | Admin accounts                             |
| associationPayouts | Monthly payout tracking                    |
| systemConfig       | System-wide configurable settings          |

---

### Collection Schemas

#### 1. users

```javascript
{
  _id: ObjectId,
  phone: String,              // unique, indexed
  name: String,
  email: String,              // optional
  walletBalance: Number,      // default: 0
  cancellationCount: Number,  // lifetime count, default: 0
  status: String,             // "ACTIVE", "BLOCKED", "DELETED"
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}

// Indexes
{ phone: 1 }                  // unique
{ status: 1 }
```

#### 2. vendors

```javascript
{
  _id: ObjectId,
  phone: String,              // unique, indexed
  email: String,              // optional
  ownerName: String,

  registrationType: String,   // "ASSOCIATION" or "INDEPENDENT"

  // Association Details
  associationMemberId: String,
  associationIdProofUrl: String,

  // Independent Payment
  registrationPayment: {
    amount: Number,
    paymentId: String,
    paidAt: Date
  },

  // Documents
  documents: {
    shopLicense: String,
    ownerIdProof: String
  },

  // Verification
  verificationStatus: String, // "PENDING", "APPROVED", "REJECTED"
  verificationNote: String,
  verifiedAt: Date,
  verifiedBy: ObjectId,

  // Notification Settings (cannot disable sound)
  notificationSettings: {
    voiceAnnouncements: Boolean  // default: true
  },

  // Cancellation Tracking
  cancellationCount: Number,
  cancellationsThisWeek: Number,
  lastCancellationAt: Date,
  isFlagged: Boolean,         // default: false
  flaggedAt: Date,

  // Block Status
  isBlocked: Boolean,         // default: false
  blockedAt: Date,
  blockedBy: ObjectId,
  blockReason: String,

  status: String,             // "PENDING", "ACTIVE", "SUSPENDED", "DELETED"
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}

// Indexes
{ phone: 1 }                  // unique
{ verificationStatus: 1 }
{ status: 1 }
{ isBlocked: 1 }
{ isFlagged: 1 }
{ registrationType: 1 }
```

#### 3. shops

```javascript
{
  _id: ObjectId,
  vendorId: ObjectId,

  name: String,
  description: String,
  shopType: String,           // "MENS", "WOMENS", "UNISEX"
  phone: String,              // not shown to users

  address: {
    line1: String,
    line2: String,
    area: String,
    city: String,
    district: String,
    state: String,
    pincode: String
  },

  location: {
    type: "Point",
    coordinates: [Number, Number]  // [longitude, latitude]
  },

  workingHours: {
    monday: { open: String, close: String, isOpen: Boolean },
    tuesday: { open: String, close: String, isOpen: Boolean },
    wednesday: { open: String, close: String, isOpen: Boolean },
    thursday: { open: String, close: String, isOpen: Boolean },
    friday: { open: String, close: String, isOpen: Boolean },
    saturday: { open: String, close: String, isOpen: Boolean },
    sunday: { open: String, close: String, isOpen: Boolean }
  },

  photos: [String],           // max 10

  rating: {
    average: Number,          // default: 0
    count: Number             // default: 0
  },

  isActive: Boolean,          // default: true
  status: String,             // "ACTIVE", "INACTIVE", "DELETED"
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ vendorId: 1 }
{ location: "2dsphere" }
{ shopType: 1 }
{ status: 1, isActive: 1 }
{ "rating.average": -1 }
{ "address.city": 1 }
```

#### 4. barbers

```javascript
{
  _id: ObjectId,
  shopId: ObjectId,
  vendorId: ObjectId,

  name: String,
  phone: String,
  photo: String,              // optional

  rating: {
    average: Number,          // default: 0
    count: Number             // default: 0
  },

  defaultServiceId: ObjectId, // for quick block

  isActive: Boolean,          // default: true
  status: String,             // "ACTIVE", "INACTIVE", "DELETED"
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ shopId: 1 }
{ vendorId: 1 }
{ shopId: 1, isActive: 1, status: 1 }
```

#### 5. serviceCategories

```javascript
{
  _id: ObjectId,
  shopId: ObjectId,           // null = system default
  name: String,
  displayOrder: Number,
  isActive: Boolean,          // default: true
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ shopId: 1, isActive: 1, displayOrder: 1 }
```

#### 6. services

```javascript
{
  _id: ObjectId,
  shopId: ObjectId,
  categoryId: ObjectId,

  name: String,
  description: String,
  basePrice: Number,
  baseDurationMinutes: Number,
  applicableFor: String,      // "MALE", "FEMALE", "ALL"

  isActive: Boolean,          // default: true
  status: String,             // "ACTIVE", "DELETED"
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ shopId: 1, isActive: 1 }
{ shopId: 1, categoryId: 1, isActive: 1 }
```

#### 7. barberServices

```javascript
{
  _id: ObjectId,
  barberId: ObjectId,
  serviceId: ObjectId,
  shopId: ObjectId,

  price: Number,
  durationMinutes: Number,
  isActive: Boolean,

  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ barberId: 1, isActive: 1 }
{ shopId: 1, serviceId: 1, isActive: 1 }
{ barberId: 1, serviceId: 1 }  // unique compound
```

#### 8. barberAvailability

```javascript
{
  _id: ObjectId,
  barberId: ObjectId,
  shopId: ObjectId,

  date: Date,
  isWorking: Boolean,

  workingHours: {
    start: String,            // "09:00"
    end: String               // "18:00"
  },

  breaks: [{
    start: String,
    end: String,
    reason: String
  }],

  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ barberId: 1, date: 1 }      // unique compound
{ shopId: 1, date: 1 }
```

#### 9. bookings

```javascript
{
  _id: ObjectId,
  bookingNumber: String,      // "FLB12345", unique

  userId: ObjectId,
  userName: String,           // denormalized
  userPhone: String,          // denormalized

  shopId: ObjectId,
  shopName: String,           // denormalized

  barberId: ObjectId,
  barberName: String,         // denormalized
  barberSelectionType: String, // "SPECIFIC" or "ANY_AVAILABLE"

  date: Date,
  startTime: String,
  endTime: String,
  totalDurationMinutes: Number,

  services: [{
    serviceId: ObjectId,
    serviceName: String,
    categoryName: String,
    durationMinutes: Number,
    price: Number
  }],

  totalServiceAmount: Number,
  advancePaid: Number,        // ₹10
  remainingAmount: Number,

  paymentId: ObjectId,

  status: String,             // "CONFIRMED", "COMPLETED", "CANCELLED_BY_USER",
                              // "CANCELLED_BY_VENDOR", "NO_SHOW"

  cancellation: {
    cancelledAt: Date,
    cancelledBy: String,      // "USER" or "VENDOR"
    reason: String,
    refundAmount: Number,
    refundType: String,       // "WALLET" or "ORIGINAL_PAYMENT"
    refundStatus: String      // "PENDING", "COMPLETED", "FAILED"
  },

  completedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ bookingNumber: 1 }          // unique
{ userId: 1, status: 1, createdAt: -1 }
{ shopId: 1, date: 1, status: 1 }
{ barberId: 1, date: 1, status: 1 }
```

#### 10. slotBlocks

```javascript
{
  _id: ObjectId,
  shopId: ObjectId,
  barberId: ObjectId,

  date: Date,
  startTime: String,
  endTime: String,

  serviceId: ObjectId,
  serviceName: String,
  durationMinutes: Number,

  reason: String,             // "WALK_IN", "BREAK", "OTHER"
  status: String,             // "ACTIVE", "RELEASED"

  createdBy: ObjectId,
  createdAt: Date,
  releasedAt: Date
}

// Indexes
{ barberId: 1, date: 1, status: 1 }
{ shopId: 1, date: 1 }
```

#### 11. slotLocks (TTL)

```javascript
{
  _id: ObjectId,
  shopId: ObjectId,
  barberId: ObjectId,

  date: Date,
  startTime: String,
  endTime: String,

  lockedBy: ObjectId,         // User ID
  expiresAt: Date             // TTL
}

// Indexes
{ expiresAt: 1 }, { expireAfterSeconds: 0 }
{ barberId: 1, date: 1, startTime: 1 }
```

#### 12. payments

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId,
  userId: ObjectId,

  amount: Number,
  method: String,             // "RAZORPAY" or "WALLET"

  razorpay: {
    orderId: String,
    paymentId: String,
    signature: String
  },

  walletTransactionId: ObjectId,

  status: String,             // "PENDING", "CAPTURED", "FAILED", "REFUNDED"

  refund: {
    amount: Number,
    type: String,             // "WALLET" or "ORIGINAL"
    razorpayRefundId: String,
    walletTransactionId: ObjectId,
    status: String,
    refundedAt: Date
  },

  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ bookingId: 1 }              // unique
{ userId: 1, createdAt: -1 }
{ "razorpay.paymentId": 1 }
```

#### 13. walletTransactions

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  type: String,               // "CREDIT" or "DEBIT"
  amount: Number,

  balanceBefore: Number,
  balanceAfter: Number,

  referenceType: String,      // "BOOKING_PAYMENT", "CANCELLATION_REFUND", "PROMOTIONAL"
  referenceId: ObjectId,

  description: String,
  createdAt: Date
}

// Indexes
{ userId: 1, createdAt: -1 }
{ referenceType: 1, referenceId: 1 }
```

#### 14. reviews

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId,        // unique
  userId: ObjectId,
  shopId: ObjectId,
  barberId: ObjectId,

  rating: Number,             // 1-5
  comment: String,            // max 500 chars

  status: String,             // "ACTIVE", "HIDDEN", "DELETED"
  createdAt: Date
}

// Indexes
{ bookingId: 1 }              // unique
{ shopId: 1, status: 1, createdAt: -1 }
{ barberId: 1, status: 1 }
```

#### 15. userFavorites

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  shopId: ObjectId,
  createdAt: Date
}

// Indexes
{ userId: 1, shopId: 1 }      // unique compound
{ userId: 1 }
```

#### 16. bookingIssues

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId,
  userId: ObjectId,
  shopId: ObjectId,
  vendorId: ObjectId,
  barberId: ObjectId,

  type: String,               // "SHOP_CLOSED", "BARBER_NOT_AVAILABLE",
                              // "EXCESSIVE_WAIT", "OTHER"
  description: String,

  userLocation: {
    type: "Point",
    coordinates: [Number, Number]
  },
  distanceFromShop: Number,

  photoUrl: String,

  refundAmount: Number,
  refundStatus: String,

  status: String,             // "REPORTED", "UNDER_REVIEW", "RESOLVED", "REJECTED"

  reviewedBy: ObjectId,
  reviewedAt: Date,
  adminNotes: String,

  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ bookingId: 1 }
{ vendorId: 1 }
{ status: 1, createdAt: -1 }
```

#### 17. admins

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,              // unique
  phone: String,
  passwordHash: String,

  role: String,               // "SUPER_ADMIN", "SUB_ADMIN", "ASSOCIATION_ADMIN"

  status: String,             // "ACTIVE", "INACTIVE"

  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date,
  createdBy: ObjectId
}

// Indexes
{ email: 1 }                  // unique
{ role: 1, status: 1 }
```

#### 18. associationPayouts

```javascript
{
  _id: ObjectId,

  month: Number,              // 1-12
  year: Number,

  totalBookings: Number,
  sharePerBooking: Number,    // ₹2
  totalAmount: Number,

  status: String,             // "PENDING", "PAID"

  paidAmount: Number,
  paidAt: Date,
  paidBy: ObjectId,
  paymentNotes: String,

  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ year: 1, month: 1 }         // unique compound
{ status: 1 }
```

#### 19. systemConfig

```javascript
{
  _id: ObjectId,
  key: String,                // unique
  value: Mixed,
  valueType: String,          // "NUMBER", "STRING", "BOOLEAN", "JSON"
  category: String,           // "BOOKING", "CANCELLATION", "PAYMENT", "REVENUE", "LIMITS"
  displayName: String,
  description: String,
  constraints: {
    min: Number,
    max: Number,
    options: [Mixed]
  },
  updatedAt: Date,
  updatedBy: ObjectId
}

// Indexes
{ key: 1 }                    // unique
{ category: 1 }
```

**Default System Config Values**:

| Key                                | Value | Category     |
| ---------------------------------- | ----- | ------------ |
| booking.advanceAmount              | 10    | BOOKING      |
| booking.minBufferMinutes           | 30    | BOOKING      |
| booking.appointmentBufferMinutes   | 5     | BOOKING      |
| booking.slotIntervalMinutes        | 15    | BOOKING      |
| booking.slotLockMinutes            | 5     | BOOKING      |
| cancellation.userFreeWindowMinutes | 30    | CANCELLATION |
| cancellation.userLateFeePercentage | 50    | CANCELLATION |
| cancellation.userLifetimeLimit     | 10    | CANCELLATION |
| cancellation.vendorWeeklyLimit     | 5     | CANCELLATION |
| revenue.associationSharePerBooking | 2     | REVENUE      |
| limits.maxPhotosPerShop            | 10    | LIMITS       |
| limits.maxServicesPerShop          | 50    | LIMITS       |
| limits.maxBarbersPerShop           | 20    | LIMITS       |

---

## 10. Key Flows

### Flow 1: User Booking Flow

```
User opens app
    │
    ▼
Location detected
    │
    ▼
Show nearby shops (sorted by distance)
    │
    ▼
User taps on shop
    │
    ▼
Shop Details Screen
    │
    ▼
User taps "Book Now"
    │
    ▼
Select Service(s) [minimum 1 required]
    │
    ▼
Select Barber (or "Any Available")
    │
    ▼
Select Time Slot
    │
    ▼
Booking Summary Screen
    │
    ▼
Slot locked (5 min TTL)
    │
    ▼
User taps "Pay ₹10"
    │
    ├── Wallet >= ₹10 → Deduct from wallet
    │
    └── Wallet < ₹10 → Razorpay payment
            │
            ▼
    Payment success?
        │
        ├── Yes → Booking confirmed
        │         Push notification to vendor
        │         Confirmation screen
        │
        └── No → Slot lock released
                 Show error, retry option
```

### Flow 2: User Cancellation Flow

```
User opens "My Bookings"
    │
    ▼
User taps on confirmed booking
    │
    ▼
User taps "Cancel"
    │
    ▼
Check: User lifetime cancellations < 10?
    │
    ├── No → "You have reached cancellation limit. Contact support."
    │
    └── Yes → Continue
            │
            ▼
        Check: Time since payment?
            │
            ├── > 30 min → ₹10 refund to wallet
            │
            └── < 30 min → ₹5 refund (50% fee)
                    │
                    ▼
                User confirms
                    │
                    ▼
                Booking cancelled
                Refund credited to wallet
                Vendor notified
                User cancellation count +1
```

### Flow 3: Vendor Cancellation Flow

```
Vendor opens booking details
    │
    ▼
Vendor taps "Cancel"
    │
    ▼
Select reason (required)
    │
    ▼
Vendor confirms
    │
    ▼
Booking cancelled
₹10 refund to user's original payment method
User notified
Vendor cancellation count +1
    │
    ▼
Check: Vendor weekly cancellations > 5?
    │
    ├── Yes → Flag vendor for admin review
    │
    └── No → Continue normally
```

### Flow 4: Walk-in Slot Block Flow

```
Walk-in customer arrives
    │
    ▼
Vendor opens app
    │
    ▼
Vendor taps "Quick Block"
    │
    ▼
Block created:
├── Service: Default service (or selected)
├── Start: NOW
├── End: NOW + duration + 5 min buffer
    │
    ▼
Slot blocked for online users
    │
    ▼
Vendor serves walk-in
    │
    ▼
Block auto-expires at end time
(or vendor releases early)
```

### Flow 5: Slot Availability Calculation

```
Input: barberId, date (today), totalDurationMinutes

Step 1: Get barberAvailability for date
        → workingHours, breaks, isWorking

Step 2: If not working → Return empty

Step 3: Get existing bookings for barber on date
        → List of booked time ranges

Step 4: Get slot blocks for barber on date
        → List of blocked time ranges

Step 5: Get slot locks for barber on date
        → List of temporarily locked ranges

Step 6: Calculate available windows:
        Working hours - breaks - bookings - blocks - locks

Step 7: Generate slot start times:
        Every 15 minutes where service fits completely

Step 8: Filter past times:
        Remove slots < (now + 30 min buffer)

Return: List of available slot times
```

### Flow 6: Association Payout Flow

```
End of month (or anytime)
    │
    ▼
Super Admin opens "Association Payouts"
    │
    ▼
Select month
    │
    ▼
System calculates:
├── Count bookings where vendor.registrationType = "ASSOCIATION"
├── AND booking.status = "COMPLETED"
├── AND booking.date in selected month
    │
    ▼
Display:
├── Bookings count
├── Share: ₹2 per booking
├── Total owed
├── Status: Pending/Paid
    │
    ▼
Super Admin pays association (manually - bank transfer)
    │
    ▼
Super Admin clicks "Mark as Paid"
    │
    ▼
Enter payment notes (optional)
    │
    ▼
Confirm
    │
    ▼
associationPayouts document updated:
├── status: "PAID"
├── paidAt: now
├── paidBy: adminId
├── paymentNotes: notes
```

### Flow 7: Vendor Registration (Association)

```
Vendor opens app → "Register"
    │
    ▼
Enter phone number
    │
    ▼
OTP verification
    │
    ▼
Enter basic details (name, shop name, address)
    │
    ▼
"Are you an Association member?" → Yes
    │
    ▼
Enter Member ID
    │
    ▼
Upload ID proof photo
    │
    ▼
Submit for verification
    │
    ▼
Vendor status: PENDING
    │
    ▼
Admin reviews application
    │
    ├── Approve → Vendor status: ACTIVE
    │             Vendor notified
    │
    └── Reject → Vendor notified with reason
                 Can re-apply
```

### Flow 8: Half-Day Leave (Emergency)

```
Barber needs to leave early (emergency)
    │
    ▼
Vendor opens barber's availability
    │
    ▼
Updates working hours end time to leave time
    │
    ▼
System shows affected bookings (after leave time)
    │
    ▼
Vendor must manually cancel each booking
    │
    ▼
For each cancellation:
├── ₹10 refund to user's original payment
├── User notified
├── Vendor cancellation count +1
```

---

## 11. Validations & Error Messages

### User App Validations

| Field/Action          | Rule                       | Error Message                                 |
| --------------------- | -------------------------- | --------------------------------------------- |
| Phone number          | 10 digits, starts with 6-9 | "Enter valid 10-digit mobile number"          |
| OTP                   | 6 digits                   | "Enter 6-digit OTP"                           |
| OTP expired           | 60 seconds                 | "OTP expired. Tap resend"                     |
| Name                  | 2-50 characters            | "Enter valid name"                            |
| Email                 | Valid email format         | "Enter valid email"                           |
| Service selection     | Minimum 1                  | "Select at least one service"                 |
| Slot selection        | Required                   | "Select a time slot"                          |
| Cancellation limit    | < 10 lifetime              | "You have reached your cancellation limit"    |
| Report issue location | Within 500m of shop        | "You must be at the shop to report"           |
| Report issue time     | Within ±30 min of booking  | "You can only report around appointment time" |

### Vendor App Validations

| Field/Action     | Rule                     | Error Message                        |
| ---------------- | ------------------------ | ------------------------------------ |
| Phone number     | 10 digits                | "Enter valid 10-digit mobile number" |
| Shop name        | 3-100 characters         | "Enter valid shop name"              |
| Address          | 10-200 characters        | "Enter complete address"             |
| Member ID        | Required for association | "Enter your association member ID"   |
| Service name     | 2-50 characters          | "Enter valid service name"           |
| Service price    | > 0                      | "Enter valid price"                  |
| Service duration | 5-180 minutes            | "Duration must be 5-180 minutes"     |
| Barber name      | 2-50 characters          | "Enter valid name"                   |
| Barber phone     | 10 digits                | "Enter valid phone number"           |
| Working hours    | End > Start              | "End time must be after start time"  |
| Cancel reason    | Required                 | "Select a reason for cancellation"   |

### Common Errors

| Scenario        | Message                                        |
| --------------- | ---------------------------------------------- |
| No internet     | "No internet connection. Check your network."  |
| API timeout     | "Something went wrong. Please try again."      |
| Server error    | "We're experiencing issues. Please try later." |
| Session expired | "Session expired. Please login again."         |

### User App Errors

| Scenario            | Message                                             |
| ------------------- | --------------------------------------------------- |
| Location denied     | "Location access needed to find nearby shops."      |
| No shops nearby     | "No shops available in your area yet."              |
| No slots available  | "No slots available today. Try another shop."       |
| Slot just booked    | "This slot was just booked. Please select another." |
| Payment failed      | "Payment failed. Please try again."                 |
| Wallet insufficient | "Insufficient wallet balance."                      |

### Vendor App Errors

| Scenario              | Message                                             |
| --------------------- | --------------------------------------------------- |
| Verification pending  | "Your account is under verification."               |
| Verification rejected | "Verification rejected: [reason]"                   |
| Cannot delete barber  | "Cannot delete barber with upcoming bookings."      |
| Cannot delete service | "Cannot delete service assigned to barbers."        |
| Account blocked       | "Your account has been suspended. Reason: [reason]" |

---

## 12. Screen States

### User App Screens

| Screen            | States                                        |
| ----------------- | --------------------------------------------- |
| Shop List         | Loading, Empty (no shops), Default, Error     |
| Shop Details      | Loading, Default, Error                       |
| Service Selection | Loading, Empty, Default, Error                |
| Barber Selection  | Loading, Default, All Unavailable             |
| Slot Selection    | Loading, Empty (no slots), Default, Error     |
| Booking Summary   | Default                                       |
| Payment           | Processing, Success, Failed                   |
| My Bookings       | Loading, Empty, Default, Error                |
| Booking Details   | Loading, Default, Error                       |
| Wallet            | Loading, Empty (zero balance), Default, Error |
| Favorites         | Loading, Empty, Default, Error                |

### Vendor App Screens

| Screen             | States                                       |
| ------------------ | -------------------------------------------- |
| Dashboard          | Loading, Empty (no bookings), Default, Error |
| Booking List       | Loading, Empty, Default, Error               |
| Booking Details    | Default                                      |
| Barber List        | Loading, Empty, Default, Error               |
| Service List       | Loading, Empty, Default, Error               |
| Availability Setup | Loading, Default, Error                      |

### Admin Panel Screens

| Screen             | States                         |
| ------------------ | ------------------------------ |
| Dashboard          | Loading, Default, Error        |
| Vendor List        | Loading, Empty, Default, Error |
| User List          | Loading, Empty, Default, Error |
| Booking List       | Loading, Empty, Default, Error |
| Issue List         | Loading, Empty, Default, Error |
| Verification Queue | Loading, Empty, Default, Error |

---

## 13. Notifications

### User Notifications

| Event                         | Push Notification                                     | Voice (if enabled) |
| ----------------------------- | ----------------------------------------------------- | ------------------ |
| Booking Confirmed             | "Booking confirmed at [Shop] for [Time]"              | No                 |
| Booking Cancelled (by user)   | "Your booking was cancelled. ₹X refunded to wallet"   | No                 |
| Booking Cancelled (by vendor) | "Your booking was cancelled by [Shop]. ₹10 refunded." | No                 |
| Reminder (1 hour)             | "Your appointment at [Shop] is in 1 hour"             | Yes                |
| Reminder (30 min)             | "Your appointment at [Shop] is in 30 minutes"         | Yes                |
| Review Request                | "How was your experience at [Shop]? Rate now"         | No                 |

### Vendor Notifications

| Event                | Push Notification                                     | Voice | Sound Duration |
| -------------------- | ----------------------------------------------------- | ----- | -------------- |
| New Booking          | "New booking from [Customer] for [Service] at [Time]" | Yes   | 10 seconds     |
| Booking Cancelled    | "[Customer] cancelled [Time] booking"                 | No    | Normal         |
| Cancellation Warning | "Warning: [X] cancellations this week"                | No    | Normal         |
| Account Blocked      | "Your account has been suspended. Reason: [reason]"   | No    | Normal         |
| Account Unblocked    | "Your account has been reactivated"                   | No    | Normal         |

---

## 14. What's NOT Included (MVP Scope)

### User App - Not in MVP

| Feature                        | Reason                                 |
| ------------------------------ | -------------------------------------- |
| Social login (Google/Facebook) | Not critical                           |
| Profile photo                  | Not critical                           |
| Map view                       | Cost (Google Maps API)                 |
| Price range filter             | Not critical                           |
| Next day booking               | Business decision (same-day only)      |
| Reschedule booking             | Complexity (cancel and rebook instead) |
| Add to Calendar                | Not critical                           |
| Contact vendor (in-app)        | Not critical                           |
| Add money to wallet            | Business decision                      |
| Withdraw from wallet           | Business decision                      |
| Wallet expiry                  | Complexity                             |
| Rate barber separately         | Complexity                             |
| Photo in review                | Not critical                           |
| Vendor response to review      | Complexity                             |
| SMS notifications              | Cost                                   |
| Email notifications            | Not critical                           |
| WhatsApp notifications         | Complexity                             |

### Vendor App - Not in MVP

| Feature                  | Reason                                |
| ------------------------ | ------------------------------------- |
| Service images           | Not critical                          |
| Service variants         | Complexity (add as separate services) |
| Weekly schedule template | Complexity                            |
| Recurring availability   | Complexity                            |
| Revenue reports          | Phase 2                               |
| Performance analytics    | Phase 2                               |
| Export data              | Not critical                          |
| Custom slot block        | Complexity (quick block sufficient)   |
| View blocked slots list  | Complexity                            |

### Admin Panel - Not in MVP

| Feature                      | Reason                         |
| ---------------------------- | ------------------------------ |
| Association CRUD             | Only one association currently |
| Custom permissions per admin | Fixed roles sufficient         |

### Phase 2 Features

| Feature                   | Description                  |
| ------------------------- | ---------------------------- |
| Loyalty/Reward Points     | 1 booking = 1 point, rewards |
| Google Maps Integration   | Show map, directions         |
| Hindi Language            | Third language support       |
| Advanced Analytics        | Vendor performance reports   |
| Export Data               | CSV/Excel exports            |
| Individual Barber Ratings | Separate from shop rating    |

---

## 15. Open Decisions & Configurations

### Configurable Values (via System Config)

| Setting                       | Default | Can Change |
| ----------------------------- | ------- | ---------- |
| Advance amount                | ₹10     | Yes        |
| Minimum booking buffer        | 30 min  | Yes        |
| Slot interval                 | 15 min  | Yes        |
| Appointment buffer            | 5 min   | Yes        |
| Slot lock duration            | 5 min   | Yes        |
| Free cancellation window      | 30 min  | Yes        |
| Late cancellation fee         | 50%     | Yes        |
| User lifetime cancel limit    | 10      | Yes        |
| Vendor weekly cancel limit    | 5       | Yes        |
| Association share per booking | ₹2      | Yes        |
| Max photos per shop           | 10      | Yes        |
| Max services per shop         | 50      | Yes        |
| Max barbers per shop          | 20      | Yes        |

### Not Yet Decided

| Item                                | Options                      | Current Default |
| ----------------------------------- | ---------------------------- | --------------- |
| Independent vendor registration fee | ₹500? ₹1000?                 | TBD             |
| Notification sound duration         | 10 seconds                   | Confirmed       |
| Wallet balance expiry               | No expiry? 6 months? 1 year? | No expiry (MVP) |
| Review edit/delete                  | Allow? Disallow?             | Disallowed      |

---

## Summary

This document contains the complete context for the Felbo project:

1. **Business Model**: Same-day booking, ₹10 advance, association partnership
2. **User Roles**: User, Vendor, Barber, Super Admin, Sub Admin, Association Admin
3. **User App**: 10 feature modules including booking, wallet, reviews, favorites
4. **Vendor App**: 11 feature modules including booking management, walk-in blocking
5. **Admin Panel**: 11 feature sections including financial management, cancellation tracking
6. **Database**: 19 collections with complete schemas
7. **Key Flows**: 8 detailed flows including booking, cancellation, payouts
8. **Validations**: Complete validation rules and error messages
9. **Notifications**: Push and voice notification specifications

---

**Document Version**: 1.0
**Last Updated**: February 2025
**Status**: Ready for Development
