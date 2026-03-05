import { Worker, Job } from 'bullmq';
import { connectMongo } from '../database/mongo';
import { initFirebase, sendFcmNotification } from '../notification/fcm.service';
import { NotificationJobData } from '../notification/notification.queue';
import { getBullConnection, QUEUE_NAMES } from '../queue/bull';
import { logger } from '../logger/logger';
import { UserModel } from '../../modules/user/user.model';
import { VendorModel } from '../../modules/vendor/vendor.model';

async function bootstrap(): Promise<void> {
  await connectMongo();
  initFirebase();
  logger.info('Notification worker started');
}

async function getUserTokens(userIds: string[]): Promise<string[]> {
  const users = await UserModel.find(
    { _id: { $in: userIds }, status: 'ACTIVE' },
    { fcmTokens: 1 },
  ).lean();
  return users.flatMap((u) => u.fcmTokens ?? []);
}

async function getVendorTokens(vendorId: string): Promise<string[]> {
  const vendor = await VendorModel.findById(vendorId, { fcmTokens: 1 }).lean();
  return vendor?.fcmTokens ?? [];
}

async function pruneInvalidUserTokens(invalidTokens: string[]): Promise<void> {
  if (!invalidTokens.length) return;
  await UserModel.updateMany(
    { fcmTokens: { $in: invalidTokens } },
    { $pull: { fcmTokens: { $in: invalidTokens } } },
  );
}

async function pruneInvalidVendorTokens(invalidTokens: string[]): Promise<void> {
  if (!invalidTokens.length) return;
  await VendorModel.updateMany(
    { fcmTokens: { $in: invalidTokens } },
    { $pull: { fcmTokens: { $in: invalidTokens } } },
  );
}

function buildUserMessage(data: NotificationJobData): {
  title: string;
  body: string;
  data?: Record<string, string>;
} {
  switch (data.jobName) {
    case 'BOOKING_CONFIRMED_USER':
      return {
        title: 'Booking Confirmed!',
        body: `Your booking at ${data.shopName} is confirmed for ${data.appointmentTime}`,
        data: { type: 'BOOKING_CONFIRMED', shopName: data.shopName ?? '' },
      };
    case 'BOOKING_CANCELLED_USER':
      return {
        title: 'Booking Cancelled',
        body: `Your booking was cancelled. Refund: ₹${data.refundAmount ?? 0}`,
        data: { type: 'BOOKING_CANCELLED', refundAmount: String(data.refundAmount ?? 0) },
      };
    case 'REMINDER_1HR':
      return {
        title: 'Appointment Reminder',
        body: `Your appointment at ${data.shopName} is in 1 hour`,
        data: { type: 'REMINDER', shopName: data.shopName ?? '', minutes: '60' },
      };
    case 'REMINDER_30MIN':
      return {
        title: 'Appointment Reminder',
        body: `Your appointment at ${data.shopName} is in 30 minutes`,
        data: { type: 'REMINDER', shopName: data.shopName ?? '', minutes: '30' },
      };
    case 'REVIEW_PROMPT':
      return {
        title: 'How was your experience?',
        body: `Rate your visit to ${data.shopName}`,
        data: { type: 'REVIEW_PROMPT', shopName: data.shopName ?? '' },
      };
    default:
      return { title: '', body: '' };
  }
}

function buildVendorMessage(data: NotificationJobData): {
  title: string;
  body: string;
  data?: Record<string, string>;
} {
  switch (data.jobName) {
    case 'BOOKING_CONFIRMED_VENDOR':
      return {
        title: `New Booking from ${data.customerName}`,
        body: `${data.serviceName} at ${data.appointmentTime}`,
        data: {
          type: 'NEW_BOOKING',
          tts: 'true',
          customerName: data.customerName ?? '',
          appointmentTime: data.appointmentTime ?? '',
        },
      };
    case 'BOOKING_CANCELLED_VENDOR':
      return {
        title: 'Booking Cancelled',
        body: `${data.customerName} cancelled their ${data.appointmentTime} booking`,
        data: { type: 'BOOKING_CANCELLED' },
      };
    case 'VENDOR_WARNING':
      return {
        title: 'Cancellation Warning',
        body: `You have ${data.cancellationCount} cancellations this week. Limit is 5.`,
        data: { type: 'VENDOR_WARNING' },
      };
    case 'VENDOR_SUSPENDED':
      return {
        title: 'Account Suspended',
        body: `Your account has been suspended. Reason: ${data.suspendReason}`,
        data: { type: 'VENDOR_SUSPENDED' },
      };
    case 'VENDOR_REACTIVATED':
      return {
        title: 'Account Reactivated',
        body: 'Your account has been reactivated.',
        data: { type: 'VENDOR_REACTIVATED' },
      };
    default:
      return { title: '', body: '' };
  }
}

const USER_JOB_NAMES: NotificationJobData['jobName'][] = [
  'BOOKING_CONFIRMED_USER',
  'BOOKING_CANCELLED_USER',
  'REMINDER_1HR',
  'REMINDER_30MIN',
  'REVIEW_PROMPT',
];

const VENDOR_JOB_NAMES: NotificationJobData['jobName'][] = [
  'BOOKING_CONFIRMED_VENDOR',
  'BOOKING_CANCELLED_VENDOR',
  'VENDOR_WARNING',
  'VENDOR_SUSPENDED',
  'VENDOR_REACTIVATED',
];

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { data } = job;
  logger.info(`Processing notification job: ${data.jobName}`, { jobId: job.id });

  if (USER_JOB_NAMES.includes(data.jobName)) {
    const tokens = await getUserTokens(data.userIds ?? []);
    if (!tokens.length) return;

    const message = buildUserMessage(data);
    const result = await sendFcmNotification({ tokens, ...message });

    if (result.invalidTokens.length) {
      await pruneInvalidUserTokens(result.invalidTokens);
    }

    logger.info(`User notification sent`, { jobName: data.jobName, ...result });
  } else if (VENDOR_JOB_NAMES.includes(data.jobName)) {
    if (!data.vendorId) return;
    const tokens = await getVendorTokens(data.vendorId);
    if (!tokens.length) return;

    const message = buildVendorMessage(data);
    const result = await sendFcmNotification({
      tokens,
      ...message,
      android: {
        priority: data.jobName === 'BOOKING_CONFIRMED_VENDOR' ? 'high' : 'normal',
      },
    });

    if (result.invalidTokens.length) {
      await pruneInvalidVendorTokens(result.invalidTokens);
    }
    logger.info(`Vendor notification sent`, { jobName: data.jobName, ...result });
  }
}

bootstrap()
  .then(() => {
    const worker = new Worker<NotificationJobData>(
      QUEUE_NAMES.NOTIFICATIONS,
      processNotificationJob,
      {
        connection: getBullConnection(),
        concurrency: 10,
      },
    );

    worker.on('completed', (job) => {
      logger.info(`Notification job completed: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Notification job failed: ${job?.id}`, {
        error: err.message,
        jobName: job?.data?.jobName,
      });
    });

    process.on('SIGTERM', () => {
      logger.info('Notification worker shutting down...');
      worker
        .close()
        .then(() => {
          logger.info('Worker closed gracefully');
          process.exit(0);
        })
        .catch((err) => {
          logger.error('Worker failed to close cleanly', err);
          process.exit(1);
        });
    });
  })
  .catch((err) => {
    logger.error('Notification worker failed to start', err);
    process.exit(1);
  });
