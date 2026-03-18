import { Queue } from 'bullmq';
import { createQueue, QUEUE_NAMES } from '../queue/bull';

// ─── Job name union ──────────────────────────────────────────────────────────
// Each job name maps 1:1 to one notification event. Keeping them distinct
// makes the worker switch exhaustive and easy to trace in Bull dashboard.

export type NotificationJobName =
  // User-facing
  | 'BOOKING_CONFIRMED_USER'
  | 'BOOKING_CANCELLED_BY_VENDOR' // always 100% refund
  | 'BOOKING_CANCELLED_BY_USER' // refund amount varies
  | 'REMINDER_1HR'
  | 'REMINDER_30MIN'
  | 'REVIEW_PROMPT'
  // Vendor-facing
  | 'NEW_BOOKING_VENDOR' // loud alert + optional TTS voice
  | 'BOOKING_CANCELLED_VENDOR' // customer cancelled their booking
  | 'VENDOR_WARNING' // approaching cancellation limit
  | 'VENDOR_SUSPENDED'
  | 'VENDOR_REACTIVATED';

// ─── Job payloads ────────────────────────────────────────────────────────────
// Each job carries only what its handler needs — nothing more.
// The worker never queries the DB for notification content; everything is
// denormalised at enqueue time to keep the worker fast and DB-load low.

export interface BookingConfirmedUserJob {
  jobName: 'BOOKING_CONFIRMED_USER';
  userId: string;
  shopName: string;
  appointmentTime: string; // "10:30 AM"
  appointmentAt: string; // ISO datetime — used to schedule reminder jobs
  bookingId: string;
}

export interface BookingCancelledByVendorJob {
  jobName: 'BOOKING_CANCELLED_BY_VENDOR';
  userId: string;
  shopName: string;
  refundAmount: number;
}

export interface BookingCancelledByUserJob {
  jobName: 'BOOKING_CANCELLED_BY_USER';
  userId: string;
  refundAmount: number;
}

export interface ReminderJob {
  jobName: 'REMINDER_1HR' | 'REMINDER_30MIN';
  userId: string;
  shopName: string;
  appointmentTime: string;
}

export interface ReviewPromptJob {
  jobName: 'REVIEW_PROMPT';
  userId: string;
  shopName: string;
  bookingId: string;
}

export interface NewBookingVendorJob {
  jobName: 'NEW_BOOKING_VENDOR';
  vendorId: string;
  /**
   * Whether to generate a Malayalam TTS audio clip.
   * Copied from vendor.notificationSettings.voiceAnnouncements at enqueue time.
   * The worker does NOT re-query this — it trusts what was set at booking time.
   */
  voiceEnabled: boolean;
  customerName: string;
  serviceName: string; // comma-joined if multiple: "Haircut, Beard Trim"
  appointmentTime: string; // "10:30 AM"
}

export interface BookingCancelledVendorJob {
  jobName: 'BOOKING_CANCELLED_VENDOR';
  vendorId: string;
  customerName: string;
  appointmentTime: string;
}

export interface VendorWarningJob {
  jobName: 'VENDOR_WARNING';
  vendorId: string;
  cancellationCount: number;
}

export interface VendorSuspendedJob {
  jobName: 'VENDOR_SUSPENDED';
  vendorId: string;
  suspendReason: string;
}

export interface VendorReactivatedJob {
  jobName: 'VENDOR_REACTIVATED';
  vendorId: string;
}

export type NotificationJobData =
  | BookingConfirmedUserJob
  | BookingCancelledByVendorJob
  | BookingCancelledByUserJob
  | ReminderJob
  | ReviewPromptJob
  | NewBookingVendorJob
  | BookingCancelledVendorJob
  | VendorWarningJob
  | VendorSuspendedJob
  | VendorReactivatedJob;

// ─── Queue singleton ─────────────────────────────────────────────────────────

let notificationQueue: Queue<NotificationJobData>;

function getQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = createQueue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS);
  }
  return notificationQueue;
}

// ─── Enqueue helpers ─────────────────────────────────────────────────────────
// These are the only functions booking.service (and others) should call.
// They never return values — fire-and-forget from the caller's perspective.

export async function enqueueBookingConfirmedUser(data: {
  userId: string;
  shopName: string;
  appointmentTime: string;
  appointmentAt: Date;
  bookingId: string;
}): Promise<void> {
  const queue = getQueue();

  // 1. Immediate booking confirmation
  await queue.add('BOOKING_CONFIRMED_USER', {
    jobName: 'BOOKING_CONFIRMED_USER',
    userId: data.userId,
    shopName: data.shopName,
    appointmentTime: data.appointmentTime,
    appointmentAt: data.appointmentAt.toISOString(),
    bookingId: data.bookingId,
  });

  // 2. Schedule reminder jobs at the same time.
  //    Use stable jobIds so re-enqueuing the same booking is idempotent.
  const now = Date.now();
  const appointmentMs = data.appointmentAt.getTime();

  const oneHourBefore = appointmentMs - 60 * 60 * 1000;
  const thirtyMinBefore = appointmentMs - 30 * 60 * 1000;

  const reminderPayloadBase = {
    userId: data.userId,
    shopName: data.shopName,
    appointmentTime: data.appointmentTime,
  };

  if (oneHourBefore > now) {
    await queue.add(
      'REMINDER_1HR',
      { jobName: 'REMINDER_1HR', ...reminderPayloadBase },
      {
        delay: oneHourBefore - now,
        jobId: `reminder-1hr-${data.bookingId}`, // dedup by bookingId
      },
    );
  }

  if (thirtyMinBefore > now) {
    await queue.add(
      'REMINDER_30MIN',
      { jobName: 'REMINDER_30MIN', ...reminderPayloadBase },
      {
        delay: thirtyMinBefore - now,
        jobId: `reminder-30m-${data.bookingId}`,
      },
    );
  }
}

export async function enqueueNewBookingVendor(data: {
  vendorId: string;
  voiceEnabled: boolean;
  customerName: string;
  serviceName: string;
  appointmentTime: string;
}): Promise<void> {
  await getQueue().add('NEW_BOOKING_VENDOR', {
    jobName: 'NEW_BOOKING_VENDOR',
    vendorId: data.vendorId,
    voiceEnabled: data.voiceEnabled,
    customerName: data.customerName,
    serviceName: data.serviceName,
    appointmentTime: data.appointmentTime,
  });
}

export async function enqueueBookingCancelledByVendor(data: {
  userId: string;
  shopName: string;
  refundAmount: number;
}): Promise<void> {
  await getQueue().add('BOOKING_CANCELLED_BY_VENDOR', {
    jobName: 'BOOKING_CANCELLED_BY_VENDOR',
    userId: data.userId,
    shopName: data.shopName,
    refundAmount: data.refundAmount,
  });
}

export async function enqueueBookingCancelledByUser(data: {
  userId: string;
  vendorId: string;
  customerName: string;
  appointmentTime: string;
  refundAmount: number;
}): Promise<void> {
  const queue = getQueue();

  // User gets their refund confirmation
  await queue.add('BOOKING_CANCELLED_BY_USER', {
    jobName: 'BOOKING_CANCELLED_BY_USER',
    userId: data.userId,
    refundAmount: data.refundAmount,
  });

  // Vendor gets customer-cancelled alert (no refund context needed on vendor side)
  await queue.add('BOOKING_CANCELLED_VENDOR', {
    jobName: 'BOOKING_CANCELLED_VENDOR',
    vendorId: data.vendorId,
    customerName: data.customerName,
    appointmentTime: data.appointmentTime,
  });
}

export async function enqueueReviewPrompt(data: {
  userId: string;
  shopName: string;
  bookingId: string;
}): Promise<void> {
  // Sent 15 minutes after appointment end time. The caller (booking completion
  // flow) should calculate the delay and pass it, or we use a fixed 15min delay.
  await getQueue().add(
    'REVIEW_PROMPT',
    {
      jobName: 'REVIEW_PROMPT',
      userId: data.userId,
      shopName: data.shopName,
      bookingId: data.bookingId,
    },
    {
      delay: 15 * 60 * 1000,
      jobId: `review-${data.bookingId}`, // dedup
    },
  );
}

export async function enqueueVendorWarning(data: {
  vendorId: string;
  cancellationCount: number;
}): Promise<void> {
  await getQueue().add('VENDOR_WARNING', {
    jobName: 'VENDOR_WARNING',
    vendorId: data.vendorId,
    cancellationCount: data.cancellationCount,
  });
}

export async function enqueueVendorSuspended(data: {
  vendorId: string;
  suspendReason: string;
}): Promise<void> {
  await getQueue().add('VENDOR_SUSPENDED', {
    jobName: 'VENDOR_SUSPENDED',
    vendorId: data.vendorId,
    suspendReason: data.suspendReason,
  });
}

export async function enqueueVendorReactivated(data: { vendorId: string }): Promise<void> {
  await getQueue().add('VENDOR_REACTIVATED', {
    jobName: 'VENDOR_REACTIVATED',
    vendorId: data.vendorId,
  });
}
