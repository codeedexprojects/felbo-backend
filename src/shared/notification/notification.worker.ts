import { Worker, Job } from 'bullmq';
import { connectMongo } from '../database/mongo';
import { initFirebase, sendFcmNotification, FCM_CHANNELS } from './fcm.service';
import { NotificationJobData } from './notification.queue';
import { getBullConnection, QUEUE_NAMES } from '../queue/bull';
import { logger } from '../logger/logger';
import { UserModel } from '../../modules/user/user.model';
import { VendorModel } from '../../modules/vendor/vendor.model';
import { BarberModel } from '../../modules/barber/barber.model';

// Bootstraping worker
async function bootstrap(): Promise<void> {
  await connectMongo();
  initFirebase();
  logger.info('Notification worker started');
}

// DB queries for getting tokens for worker
async function getUserTokens(userId: string): Promise<string[]> {
  const user = await UserModel.findById(userId, { fcmTokens: 1 }).lean();
  return user?.fcmTokens ?? [];
}

async function getVendorTokens(vendorId: string): Promise<string[]> {
  const vendor = await VendorModel.findById(vendorId, { fcmTokens: 1 }).lean();
  return vendor?.fcmTokens ?? [];
}

async function getBarberTokens(barberId: string): Promise<string[]> {
  const barber = await BarberModel.findById(barberId, { fcmTokens: 1 }).lean();
  return barber?.fcmTokens ?? [];
}

// Pruning invalid tokens from database
async function pruneUserTokens(invalidTokens: string[]): Promise<void> {
  if (!invalidTokens.length) return;
  await UserModel.updateMany(
    { fcmTokens: { $in: invalidTokens } },
    { $pull: { fcmTokens: { $in: invalidTokens } } },
  );
}

async function pruneVendorTokens(invalidTokens: string[]): Promise<void> {
  if (!invalidTokens.length) return;
  await VendorModel.updateMany(
    { fcmTokens: { $in: invalidTokens } },
    { $pull: { fcmTokens: { $in: invalidTokens } } },
  );
}

async function pruneBarberTokens(invalidTokens: string[]): Promise<void> {
  if (!invalidTokens.length) return;
  await BarberModel.updateMany(
    { fcmTokens: { $in: invalidTokens } },
    { $pull: { fcmTokens: { $in: invalidTokens } } },
  );
}

// Job processor
async function processJob(job: Job<NotificationJobData>): Promise<void> {
  const { data } = job;

  logger.info('Processing notification job', { jobName: data.jobName, jobId: job.id });

  switch (data.jobName) {
    // User: booking confirmed
    case 'BOOKING_CONFIRMED_USER': {
      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'Booking Confirmed!',
        body: `Your booking at ${data.shopName} is confirmed for ${data.appointmentTime}`,
        data: {
          type: 'BOOKING_CONFIRMED',
          bookingId: data.bookingId,
          shopName: data.shopName,
        },
      });

      if (result.invalidTokens.length) await pruneUserTokens(result.invalidTokens);
      logger.info('BOOKING_CONFIRMED_USER sent', result);
      break;
    }

    // User: booking cancelled by vendor
    case 'BOOKING_CANCELLED_BY_VENDOR': {
      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'Booking Cancelled',
        body: `Your booking at ${data.shopName} was cancelled. ₹${data.refundAmount} refunded.`,
        data: {
          type: 'BOOKING_CANCELLED_BY_VENDOR',
          shopName: data.shopName,
          refundAmount: String(data.refundAmount),
        },
      });

      if (result.invalidTokens.length) await pruneUserTokens(result.invalidTokens);
      logger.info('BOOKING_CANCELLED_BY_VENDOR sent', result);
      break;
    }

    // User: booking cancelled by user (their own cancellation confirmation)
    case 'BOOKING_CANCELLED_BY_USER': {
      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) return;

      const refundMsg =
        data.refundAmount > 0
          ? `₹${data.refundAmount} has been refunded to your wallet.`
          : 'No refund was issued.';

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'Booking Cancelled',
        body: `Your booking was cancelled. ${refundMsg}`,
        data: {
          type: 'BOOKING_CANCELLED_BY_USER',
          refundAmount: String(data.refundAmount),
        },
      });

      if (result.invalidTokens.length) await pruneUserTokens(result.invalidTokens);
      logger.info('BOOKING_CANCELLED_BY_USER sent', result);
      break;
    }

    // 15-min reminder: sent to both user and barber
    case 'REMINDER_15MIN': {
      const [userTokens, barberTokens] = await Promise.all([
        getUserTokens(data.userId),
        getBarberTokens(data.barberId),
      ]);

      const reminderPayload = {
        channel: FCM_CHANNELS.REMINDER,
        title: 'Appointment in 15 minutes',
        body: `Your appointment at ${data.shopName} starts in 15 minutes`,
        data: { type: 'REMINDER', shopName: data.shopName, minutesBefore: '15' },
      };

      const [userResult, barberResult] = await Promise.all([
        userTokens.length ? sendFcmNotification({ tokens: userTokens, ...reminderPayload }) : null,
        barberTokens.length
          ? sendFcmNotification({ tokens: barberTokens, ...reminderPayload })
          : null,
      ]);

      if (userResult?.invalidTokens.length) await pruneUserTokens(userResult.invalidTokens);
      if (barberResult?.invalidTokens.length) await pruneBarberTokens(barberResult.invalidTokens);

      logger.info('REMINDER_15MIN sent', {
        user: userResult ?? 'no tokens',
        barber: barberResult ?? 'no tokens',
      });
      break;
    }

    // User: review prompt
    case 'REVIEW_PROMPT': {
      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'How was your experience?',
        body: `Rate your visit to ${data.shopName}`,
        data: {
          type: 'REVIEW_PROMPT',
          bookingId: data.bookingId,
          shopName: data.shopName,
        },
      });

      if (result.invalidTokens.length) await pruneUserTokens(result.invalidTokens);
      logger.info('REVIEW_PROMPT sent', result);
      break;
    }

    // Barber: new booking alert (booking.caf plays via felbo_booking channel)
    case 'NEW_BOOKING_VENDOR': {
      const tokens = await getBarberTokens(data.barberId);
      if (!tokens.length) {
        logger.error('No tokens found for barber', { barberId: data.barberId });
        return;
      }

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.BOOKING,
        title: `New Booking from ${data.customerName}`,
        body: `${data.serviceName} at ${data.appointmentTime}`,
        data: {
          type: 'NEW_BOOKING',
          customerName: data.customerName,
          serviceName: data.serviceName,
          appointmentTime: data.appointmentTime,
        },
      });

      if (result.invalidTokens.length) await pruneBarberTokens(result.invalidTokens);
      logger.info('NEW_BOOKING_VENDOR sent', { ...result });
      break;
    }

    // Vendor: customer cancelled
    case 'BOOKING_CANCELLED_VENDOR': {
      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'Booking Cancelled',
        body: `${data.customerName} cancelled their ${data.appointmentTime} booking`,
        data: {
          type: 'BOOKING_CANCELLED_BY_CUSTOMER',
          customerName: data.customerName,
          appointmentTime: data.appointmentTime,
        },
      });

      if (result.invalidTokens.length) await pruneVendorTokens(result.invalidTokens);
      logger.info('BOOKING_CANCELLED_VENDOR sent', result);
      break;
    }

    // Vendor: cancellation warning
    case 'VENDOR_WARNING': {
      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'Cancellation Warning',
        body: `You have ${data.cancellationCount} cancellations this week. Limit is 5.`,
        data: {
          type: 'VENDOR_WARNING',
          cancellationCount: String(data.cancellationCount),
        },
      });

      if (result.invalidTokens.length) await pruneVendorTokens(result.invalidTokens);
      logger.info('VENDOR_WARNING sent', result);
      break;
    }

    // Vendor: account suspended
    case 'VENDOR_SUSPENDED': {
      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'Account Suspended',
        body: `Your account has been suspended. Reason: ${data.suspendReason}`,
        data: { type: 'VENDOR_SUSPENDED', suspendReason: data.suspendReason },
      });

      if (result.invalidTokens.length) await pruneVendorTokens(result.invalidTokens);
      logger.info('VENDOR_SUSPENDED sent', result);
      break;
    }

    // Vendor: account reactivated
    case 'VENDOR_REACTIVATED': {
      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.GENERAL,
        title: 'Account Reactivated',
        body: 'Your account has been reactivated. Welcome back!',
        data: { type: 'VENDOR_REACTIVATED' },
      });

      if (result.invalidTokens.length) await pruneVendorTokens(result.invalidTokens);
      logger.info('VENDOR_REACTIVATED sent', result);
      break;
    }

    default: {
      // TypeScript exhaustiveness — this should never be reached
      const exhaustiveCheck: never = data;
      logger.warn('Unknown notification job name', { data: exhaustiveCheck });
    }
  }
}

// Worker startup
bootstrap()
  .then(() => {
    const worker = new Worker<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, processJob, {
      connection: getBullConnection(),
      concurrency: 10,
    });

    worker.on('completed', (job) => {
      logger.info('Notification job completed', { jobId: job.id, jobName: job.data.jobName });
    });

    worker.on('failed', (job, err) => {
      logger.error('Notification job failed', {
        jobId: job?.id,
        jobName: job?.data?.jobName,
        error: err.message,
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
