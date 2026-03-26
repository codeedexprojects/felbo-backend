import { Queue } from 'bullmq';
import { createQueue, QUEUE_NAMES } from '../queue/bull';

// ─── Job type union ───────────────────────────────────────────────────────────

export type NotificationJobName =
  // User-facing
  | 'BOOKING_CONFIRMED_USER' // booking confirmed → notify user
  | 'BOOKING_CANCELLED_BY_BARBER' // barber cancelled → notify user
  // Barber-facing
  | 'NEW_BOOKING_BARBER' // new booking arrived → notify barber
  | 'BOOKING_CANCELLED_BY_USER' // user cancelled → notify barber
  // Both
  | 'REMINDER_10MIN' // 10-min reminder → notify user + barber
  // Vendor-facing
  | 'VENDOR_APPROVED'; // admin approved vendor → notify vendor

// ─── Job interfaces ───────────────────────────────────────────────────────────

export interface BookingConfirmedUserJob {
  jobName: 'BOOKING_CONFIRMED_USER';
  userId: string;
  shopName: string;
  appointmentTime: string;
  bookingId: string;
}

export interface BookingCancelledByBarberJob {
  jobName: 'BOOKING_CANCELLED_BY_BARBER';
  userId: string;
  shopName: string;
}

export interface NewBookingBarberJob {
  jobName: 'NEW_BOOKING_BARBER';
  barberId: string;
  customerName: string;
  serviceName: string;
  appointmentTime: string;
}

export interface BookingCancelledByUserJob {
  jobName: 'BOOKING_CANCELLED_BY_USER';
  barberId: string;
  customerName: string;
  appointmentTime: string;
}

export interface Reminder10MinJob {
  jobName: 'REMINDER_10MIN';
  userId: string;
  barberId: string;
  shopName: string;
  appointmentTime: string;
  bookingId: string;
}

export interface VendorApprovedJob {
  jobName: 'VENDOR_APPROVED';
  vendorId: string;
}

export type NotificationJobData =
  | BookingConfirmedUserJob
  | BookingCancelledByBarberJob
  | NewBookingBarberJob
  | BookingCancelledByUserJob
  | Reminder10MinJob
  | VendorApprovedJob;

// ─── Queue singleton ──────────────────────────────────────────────────────────

let notificationQueue: Queue<NotificationJobData>;

function getQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = createQueue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS);
  }
  return notificationQueue;
}

// ─── Enqueue helpers ──────────────────────────────────────────────────────────

export async function enqueueBookingConfirmedUser(data: {
  userId: string;
  shopName: string;
  appointmentTime: string;
  bookingId: string;
}): Promise<void> {
  await getQueue().add('BOOKING_CONFIRMED_USER', {
    jobName: 'BOOKING_CONFIRMED_USER',
    ...data,
  });
}

export async function enqueueNewBookingBarber(data: {
  barberId: string;
  customerName: string;
  serviceName: string;
  appointmentTime: string;
}): Promise<void> {
  await getQueue().add('NEW_BOOKING_BARBER', {
    jobName: 'NEW_BOOKING_BARBER',
    ...data,
  });
}

export async function enqueueReminder10Min(data: {
  userId: string;
  barberId: string;
  shopName: string;
  appointmentTime: string;
  appointmentAt: Date;
  bookingId: string;
}): Promise<void> {
  const delay = data.appointmentAt.getTime() - 10 * 60 * 1000 - Date.now();
  if (delay <= 0) return; // appointment too soon or already past

  await getQueue().add(
    'REMINDER_10MIN',
    {
      jobName: 'REMINDER_10MIN',
      userId: data.userId,
      barberId: data.barberId,
      shopName: data.shopName,
      appointmentTime: data.appointmentTime,
      bookingId: data.bookingId,
    },
    {
      delay,
      jobId: `reminder-10m-${data.bookingId}`,
    },
  );
}

export async function enqueueBookingCancelledByBarber(data: {
  userId: string;
  shopName: string;
}): Promise<void> {
  await getQueue().add('BOOKING_CANCELLED_BY_BARBER', {
    jobName: 'BOOKING_CANCELLED_BY_BARBER',
    ...data,
  });
}

export async function enqueueBookingCancelledByUser(data: {
  barberId: string;
  customerName: string;
  appointmentTime: string;
}): Promise<void> {
  await getQueue().add('BOOKING_CANCELLED_BY_USER', {
    jobName: 'BOOKING_CANCELLED_BY_USER',
    ...data,
  });
}

export async function enqueueVendorApproved(data: { vendorId: string }): Promise<void> {
  await getQueue().add('VENDOR_APPROVED', {
    jobName: 'VENDOR_APPROVED',
    vendorId: data.vendorId,
  });
}
