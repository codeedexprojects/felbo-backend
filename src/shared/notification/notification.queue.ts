import { Queue } from 'bullmq';
import { createQueue, QUEUE_NAMES } from '../queue/bull';

export type NotificationJobName =
  | 'BOOKING_CONFIRMED_USER'
  | 'BOOKING_CONFIRMED_VENDOR'
  | 'BOOKING_CANCELLED_USER'
  | 'BOOKING_CANCELLED_VENDOR'
  | 'REMINDER_1HR'
  | 'REMINDER_30MIN'
  | 'REVIEW_PROMPT'
  | 'VENDOR_WARNING'
  | 'VENDOR_SUSPENDED'
  | 'VENDOR_REACTIVATED';

export interface NotificationJobData {
  jobName: NotificationJobName;
  userIds?: string[];
  vendorId?: string;
  shopName?: string;
  customerName?: string;
  serviceName?: string;
  appointmentTime?: string;
  refundAmount?: number;
  cancellationCount?: number;
  suspendReason?: string;
}

let notificationQueue: Queue<NotificationJobData>;

function getNotificationQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = createQueue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS);
  }
  return notificationQueue;
}

export async function enqueueBookingConfirmedUser(data: {
  userId: string;
  shopName: string;
  appointmentTime: string;
}): Promise<void> {
  await getNotificationQueue().add('BOOKING_CONFIRMED_USER', {
    jobName: 'BOOKING_CONFIRMED_USER',
    userIds: [data.userId],
    shopName: data.shopName,
    appointmentTime: data.appointmentTime,
  });
}

export async function enqueueBookingConfirmedVendor(data: {
  vendorId: string;
  customerName: string;
  serviceName: string;
  appointmentTime: string;
}): Promise<void> {
  await getNotificationQueue().add('BOOKING_CONFIRMED_VENDOR', {
    jobName: 'BOOKING_CONFIRMED_VENDOR',
    vendorId: data.vendorId,
    customerName: data.customerName,
    serviceName: data.serviceName,
    appointmentTime: data.appointmentTime,
  });
}

export async function enqueueBookingCancelledUser(data: {
  userId: string;
  refundAmount: number;
}): Promise<void> {
  await getNotificationQueue().add('BOOKING_CANCELLED_USER', {
    jobName: 'BOOKING_CANCELLED_USER',
    userIds: [data.userId],
    refundAmount: data.refundAmount,
  });
}

export async function enqueueBookingCancelledVendor(data: {
  vendorId: string;
  customerName: string;
  appointmentTime: string;
}): Promise<void> {
  await getNotificationQueue().add('BOOKING_CANCELLED_VENDOR', {
    jobName: 'BOOKING_CANCELLED_VENDOR',
    vendorId: data.vendorId,
    customerName: data.customerName,
    appointmentTime: data.appointmentTime,
  });
}

export async function enqueueReminderJobs(data: {
  userId: string;
  shopName: string;
  appointmentTime: string;
  appointmentAt: Date;
}): Promise<void> {
  const queue = getNotificationQueue();
  const now = Date.now();

  const oneHourBefore = data.appointmentAt.getTime() - 60 * 60 * 1000;
  const thirtyMinBefore = data.appointmentAt.getTime() - 30 * 60 * 1000;

  const jobData = {
    userIds: [data.userId],
    shopName: data.shopName,
    appointmentTime: data.appointmentTime,
  };

  if (oneHourBefore > now) {
    await queue.add(
      'REMINDER_1HR',
      { jobName: 'REMINDER_1HR', ...jobData },
      {
        delay: oneHourBefore - now,
        jobId: `reminder-1hr-${data.userId}-${data.appointmentAt.getTime()}`, // dedup
      },
    );
  }

  if (thirtyMinBefore > now) {
    await queue.add(
      'REMINDER_30MIN',
      { jobName: 'REMINDER_30MIN', ...jobData },
      {
        delay: thirtyMinBefore - now,
        jobId: `reminder-30m-${data.userId}-${data.appointmentAt.getTime()}`,
      },
    );
  }
}

export async function enqueueReviewPrompt(data: {
  userId: string;
  shopName: string;
}): Promise<void> {
  await getNotificationQueue().add(
    'REVIEW_PROMPT',
    {
      jobName: 'REVIEW_PROMPT',
      userIds: [data.userId],
      shopName: data.shopName,
    },
    { delay: 15 * 60 * 1000 },
  );
}

export async function enqueueVendorWarning(data: {
  vendorId: string;
  cancellationCount: number;
}): Promise<void> {
  await getNotificationQueue().add('VENDOR_WARNING', {
    jobName: 'VENDOR_WARNING',
    vendorId: data.vendorId,
    cancellationCount: data.cancellationCount,
  });
}

export async function enqueueVendorSuspended(data: {
  vendorId: string;
  suspendReason: string;
}): Promise<void> {
  await getNotificationQueue().add('VENDOR_SUSPENDED', {
    jobName: 'VENDOR_SUSPENDED',
    vendorId: data.vendorId,
    suspendReason: data.suspendReason,
  });
}

export async function enqueueVendorReactivated(data: { vendorId: string }): Promise<void> {
  await getNotificationQueue().add('VENDOR_REACTIVATED', {
    jobName: 'VENDOR_REACTIVATED',
    vendorId: data.vendorId,
  });
}
