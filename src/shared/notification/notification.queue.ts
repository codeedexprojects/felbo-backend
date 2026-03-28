import { Queue } from 'bullmq';
import { createQueue, QUEUE_NAMES } from '../queue/bull';

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
  | 'VENDOR_APPROVED' // admin approved vendor → notify vendor
  | 'VENDOR_REJECTED' // admin rejected vendor → notify vendor
  | 'SHOP_APPROVED' // admin approved additional shop → notify vendor
  | 'SHOP_REJECTED'; // admin rejected additional shop → notify vendor

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

export interface VendorRejectedJob {
  jobName: 'VENDOR_REJECTED';
  vendorId: string;
  reason: string;
}

export interface ShopApprovedJob {
  jobName: 'SHOP_APPROVED';
  vendorId: string;
  shopName: string;
}

export interface ShopRejectedJob {
  jobName: 'SHOP_REJECTED';
  vendorId: string;
  shopName: string;
  reason: string;
}

export type NotificationJobData =
  | BookingConfirmedUserJob
  | BookingCancelledByBarberJob
  | NewBookingBarberJob
  | BookingCancelledByUserJob
  | Reminder10MinJob
  | VendorApprovedJob
  | VendorRejectedJob
  | ShopApprovedJob
  | ShopRejectedJob;

let notificationQueue: Queue<NotificationJobData>;

function getQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = createQueue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS);
  }
  return notificationQueue;
}

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

export async function cancelReminder10Min(bookingId: string): Promise<void> {
  const jobId = `reminder-10m-${bookingId}`;
  const job = await getQueue().getJob(jobId);
  if (job) {
    await job.remove();
  }
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

export async function enqueueVendorRejected(data: {
  vendorId: string;
  reason: string;
}): Promise<void> {
  await getQueue().add('VENDOR_REJECTED', {
    jobName: 'VENDOR_REJECTED',
    vendorId: data.vendorId,
    reason: data.reason,
  });
}

export async function enqueueShopApproved(data: {
  vendorId: string;
  shopName: string;
}): Promise<void> {
  await getQueue().add('SHOP_APPROVED', {
    jobName: 'SHOP_APPROVED',
    vendorId: data.vendorId,
    shopName: data.shopName,
  });
}

export async function enqueueShopRejected(data: {
  vendorId: string;
  shopName: string;
  reason: string;
}): Promise<void> {
  await getQueue().add('SHOP_REJECTED', {
    jobName: 'SHOP_REJECTED',
    vendorId: data.vendorId,
    shopName: data.shopName,
    reason: data.reason,
  });
}
