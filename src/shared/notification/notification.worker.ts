import { Worker, Job } from 'bullmq';
import { connectMongo } from '../database/mongo';
import { initFirebase, sendFcmNotification, FCM_CHANNELS } from './fcm.service';
import { NotificationJobData } from './notification.queue';
import { getBullConnection, QUEUE_NAMES } from '../queue/bull';
import { logger } from '../logger/logger';
import { UserModel } from '../../modules/user/user.model';
import { VendorModel } from '../../modules/vendor/vendor.model';
import { BarberModel } from '../../modules/barber/barber.model';
import { NotificationModel } from '../../modules/notification/notification.model';
import type {
  NotificationRecipientRole,
  NotificationType,
} from '../../modules/notification/notification.model';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  await connectMongo();
  initFirebase();
  logger.info('Notification worker started');
}

// ─── Token helpers (select:false requires explicit +field projection) ─────────

async function getUserTokens(userId: string): Promise<string[]> {
  const user = await UserModel.findById(userId)
    .select('+fcmTokens')
    .lean<{ fcmTokens?: string[] }>();
  return user?.fcmTokens ?? [];
}

async function getVendorTokens(vendorId: string): Promise<string[]> {
  const vendor = await VendorModel.findById(vendorId)
    .select('+fcmTokens')
    .lean<{ fcmTokens?: string[] }>();
  return vendor?.fcmTokens ?? [];
}

async function getBarberTokens(barberId: string): Promise<string[]> {
  const barber = await BarberModel.findById(barberId)
    .select('+fcmTokens')
    .lean<{ fcmTokens?: string[] }>();
  return barber?.fcmTokens ?? [];
}

// ─── Token prune helpers ──────────────────────────────────────────────────────

async function pruneUserTokens(tokens: string[], jobName: string): Promise<void> {
  if (!tokens.length) return;
  await UserModel.updateMany(
    { fcmTokens: { $in: tokens } },
    { $pull: { fcmTokens: { $in: tokens } } },
  );
  logger.warn('Pruned invalid user FCM tokens', { jobName, pruned: tokens.length });
}

async function pruneVendorTokens(tokens: string[], jobName: string): Promise<void> {
  if (!tokens.length) return;
  await VendorModel.updateMany(
    { fcmTokens: { $in: tokens } },
    { $pull: { fcmTokens: { $in: tokens } } },
  );
  logger.warn('Pruned invalid vendor FCM tokens', { jobName, pruned: tokens.length });
}

async function pruneBarberTokens(tokens: string[], jobName: string): Promise<void> {
  if (!tokens.length) return;
  await BarberModel.updateMany(
    { fcmTokens: { $in: tokens } },
    { $pull: { fcmTokens: { $in: tokens } } },
  );
  logger.warn('Pruned invalid barber FCM tokens', { jobName, pruned: tokens.length });
}

// ─── Persistence helper ───────────────────────────────────────────────────────
// Uses upsert on jobId — retries are idempotent and never create duplicate records.

async function persist(
  jobId: string,
  recipientId: string,
  recipientRole: NotificationRecipientRole,
  type: NotificationType,
  title: string,
  body: string,
  jobName: string,
  data?: Record<string, string>,
): Promise<void> {
  await NotificationModel.findOneAndUpdate(
    { jobId },
    {
      $setOnInsert: {
        jobId,
        recipientId,
        recipientRole,
        type,
        title,
        body,
        data: data ?? {},
        isRead: false,
      },
    },
    { upsert: true, new: false },
  );
  logger.info('Notification persisted', { jobName, jobId, recipientId, recipientRole, type });
}

// ─── Job processor ────────────────────────────────────────────────────────────

async function processJob(job: Job<NotificationJobData>): Promise<void> {
  const { data } = job;
  const jobId = job.id!;

  logger.info('Processing notification job', { jobName: data.jobName, jobId });

  switch (data.jobName) {
    // ── User: booking confirmed ────────────────────────────────────────────────
    case 'BOOKING_CONFIRMED_USER': {
      await persist(
        `${jobId}:user`,
        data.userId,
        'user',
        'BOOKING_CONFIRMED',
        'Booking Confirmed!',
        `Your booking at ${data.shopName} is confirmed for ${data.appointmentTime}`,
        data.jobName,
        { bookingId: data.bookingId, shopName: data.shopName },
      );

      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for user — skipping push', {
          jobName: data.jobName,
          userId: data.userId,
        });
      } else {
        const result = await sendFcmNotification({
          tokens,
          channel: FCM_CHANNELS.BOOKING,
          title: 'Booking Confirmed!',
          body: `Your booking at ${data.shopName} is confirmed for ${data.appointmentTime}`,
          data: { type: 'BOOKING_CONFIRMED', bookingId: data.bookingId, shopName: data.shopName },
        });
        logger.info('FCM push sent', {
          jobName: data.jobName,
          userId: data.userId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length) await pruneUserTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    // ── Barber: new booking arrived ────────────────────────────────────────────
    case 'NEW_BOOKING_BARBER': {
      await persist(
        `${jobId}:barber`,
        data.barberId,
        'barber',
        'NEW_BOOKING',
        `New Booking from ${data.customerName}`,
        `${data.serviceName} at ${data.appointmentTime}`,
        data.jobName,
        {
          customerName: data.customerName,
          serviceName: data.serviceName,
          appointmentTime: data.appointmentTime,
        },
      );

      const tokens = await getBarberTokens(data.barberId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for barber — skipping push', {
          jobName: data.jobName,
          barberId: data.barberId,
        });
      } else {
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
        logger.info('FCM push sent', {
          jobName: data.jobName,
          barberId: data.barberId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length)
          await pruneBarberTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    // ── User: barber cancelled ─────────────────────────────────────────────────
    case 'BOOKING_CANCELLED_BY_BARBER': {
      await persist(
        `${jobId}:user`,
        data.userId,
        'user',
        'BOOKING_CANCELLED_BY_BARBER',
        'Booking Cancelled',
        `Your booking at ${data.shopName} has been cancelled by the barber.`,
        data.jobName,
        { shopName: data.shopName },
      );

      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for user — skipping push', {
          jobName: data.jobName,
          userId: data.userId,
        });
      } else {
        const result = await sendFcmNotification({
          tokens,
          channel: FCM_CHANNELS.GENERAL,
          title: 'Booking Cancelled',
          body: `Your booking at ${data.shopName} has been cancelled by the barber.`,
          data: { type: 'BOOKING_CANCELLED_BY_BARBER', shopName: data.shopName },
        });
        logger.info('FCM push sent', {
          jobName: data.jobName,
          userId: data.userId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length) await pruneUserTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    // ── Barber: user cancelled ─────────────────────────────────────────────────
    case 'BOOKING_CANCELLED_BY_USER': {
      await persist(
        `${jobId}:barber`,
        data.barberId,
        'barber',
        'BOOKING_CANCELLED_BY_USER',
        'Booking Cancelled',
        `${data.customerName} cancelled their ${data.appointmentTime} booking.`,
        data.jobName,
        { customerName: data.customerName, appointmentTime: data.appointmentTime },
      );

      const tokens = await getBarberTokens(data.barberId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for barber — skipping push', {
          jobName: data.jobName,
          barberId: data.barberId,
        });
      } else {
        const result = await sendFcmNotification({
          tokens,
          channel: FCM_CHANNELS.GENERAL,
          title: 'Booking Cancelled',
          body: `${data.customerName} cancelled their ${data.appointmentTime} booking.`,
          data: {
            type: 'BOOKING_CANCELLED_BY_USER',
            customerName: data.customerName,
            appointmentTime: data.appointmentTime,
          },
        });
        logger.info('FCM push sent', {
          jobName: data.jobName,
          barberId: data.barberId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length)
          await pruneBarberTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    // ── User + Barber: 10-min reminder ─────────────────────────────────────────
    case 'REMINDER_10MIN': {
      const reminderTitle = 'Appointment in 10 minutes';
      const reminderBody = `Your appointment at ${data.shopName} starts in 10 minutes`;
      const reminderData = { type: 'REMINDER', shopName: data.shopName, bookingId: data.bookingId };

      await Promise.all([
        persist(
          `${jobId}:user`,
          data.userId,
          'user',
          'REMINDER',
          reminderTitle,
          reminderBody,
          data.jobName,
          reminderData,
        ),
        persist(
          `${jobId}:barber`,
          data.barberId,
          'barber',
          'REMINDER',
          reminderTitle,
          reminderBody,
          data.jobName,
          reminderData,
        ),
      ]);

      const [userTokens, barberTokens] = await Promise.all([
        getUserTokens(data.userId),
        getBarberTokens(data.barberId),
      ]);

      if (!userTokens.length) {
        logger.warn('No FCM tokens for user — skipping reminder push', {
          jobName: data.jobName,
          userId: data.userId,
          bookingId: data.bookingId,
        });
      }
      if (!barberTokens.length) {
        logger.warn('No FCM tokens for barber — skipping reminder push', {
          jobName: data.jobName,
          barberId: data.barberId,
          bookingId: data.bookingId,
        });
      }

      const [userResult, barberResult] = await Promise.all([
        userTokens.length
          ? sendFcmNotification({
              tokens: userTokens,
              channel: FCM_CHANNELS.REMINDER,
              title: reminderTitle,
              body: reminderBody,
              data: reminderData,
            })
          : null,
        barberTokens.length
          ? sendFcmNotification({
              tokens: barberTokens,
              channel: FCM_CHANNELS.REMINDER,
              title: reminderTitle,
              body: reminderBody,
              data: reminderData,
            })
          : null,
      ]);

      if (userResult) {
        logger.info('FCM reminder push sent to user', {
          jobName: data.jobName,
          userId: data.userId,
          bookingId: data.bookingId,
          successCount: userResult.successCount,
          failureCount: userResult.failureCount,
          invalidTokenCount: userResult.invalidTokens.length,
        });
        if (userResult.invalidTokens.length)
          await pruneUserTokens(userResult.invalidTokens, data.jobName);
      }

      if (barberResult) {
        logger.info('FCM reminder push sent to barber', {
          jobName: data.jobName,
          barberId: data.barberId,
          bookingId: data.bookingId,
          successCount: barberResult.successCount,
          failureCount: barberResult.failureCount,
          invalidTokenCount: barberResult.invalidTokens.length,
        });
        if (barberResult.invalidTokens.length)
          await pruneBarberTokens(barberResult.invalidTokens, data.jobName);
      }
      break;
    }

    // ── Vendor: account approved ───────────────────────────────────────────────
    case 'VENDOR_APPROVED': {
      await persist(
        `${jobId}:vendor`,
        data.vendorId,
        'vendor',
        'VENDOR_APPROVED',
        'Account Approved',
        'Your Felbo vendor account has been approved. You can now accept bookings.',
        data.jobName,
      );

      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for vendor — skipping push', {
          jobName: data.jobName,
          vendorId: data.vendorId,
        });
      } else {
        const result = await sendFcmNotification({
          tokens,
          channel: FCM_CHANNELS.GENERAL,
          title: 'Account Approved',
          body: 'Your Felbo vendor account has been approved. You can now accept bookings.',
          data: { type: 'VENDOR_APPROVED' },
        });
        logger.info('FCM push sent', {
          jobName: data.jobName,
          vendorId: data.vendorId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length)
          await pruneVendorTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    // ── Vendor: account rejected ───────────────────────────────────────────────
    case 'VENDOR_REJECTED': {
      await persist(
        `${jobId}:vendor`,
        data.vendorId,
        'vendor',
        'VENDOR_REJECTED',
        'Application Not Approved',
        `Your Felbo vendor application was not approved. Reason: ${data.reason}`,
        data.jobName,
        { reason: data.reason },
      );

      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for vendor — skipping push', {
          jobName: data.jobName,
          vendorId: data.vendorId,
        });
      } else {
        const result = await sendFcmNotification({
          tokens,
          channel: FCM_CHANNELS.GENERAL,
          title: 'Application Not Approved',
          body: `Your Felbo vendor application was not approved. Reason: ${data.reason}`,
          data: { type: 'VENDOR_REJECTED', reason: data.reason },
        });
        logger.info('FCM push sent', {
          jobName: data.jobName,
          vendorId: data.vendorId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length)
          await pruneVendorTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    // ── Vendor: shop approved ──────────────────────────────────────────────────
    case 'SHOP_APPROVED': {
      await persist(
        `${jobId}:vendor`,
        data.vendorId,
        'vendor',
        'SHOP_APPROVED',
        'Shop Approved!',
        `Your shop "${data.shopName}" has been approved and is now live.`,
        data.jobName,
        { shopName: data.shopName },
      );

      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for vendor — skipping push', {
          jobName: data.jobName,
          vendorId: data.vendorId,
        });
      } else {
        const result = await sendFcmNotification({
          tokens,
          channel: FCM_CHANNELS.GENERAL,
          title: 'Shop Approved!',
          body: `Your shop "${data.shopName}" has been approved and is now live.`,
          data: { type: 'SHOP_APPROVED', shopName: data.shopName },
        });
        logger.info('FCM push sent', {
          jobName: data.jobName,
          vendorId: data.vendorId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length)
          await pruneVendorTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    // ── Vendor: shop rejected ──────────────────────────────────────────────────
    case 'SHOP_REJECTED': {
      await persist(
        `${jobId}:vendor`,
        data.vendorId,
        'vendor',
        'SHOP_REJECTED',
        'Shop Application Rejected',
        `Your shop "${data.shopName}" application was rejected. Reason: ${data.reason}`,
        data.jobName,
        { shopName: data.shopName, reason: data.reason },
      );

      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) {
        logger.warn('No FCM tokens for vendor — skipping push', {
          jobName: data.jobName,
          vendorId: data.vendorId,
        });
      } else {
        const result = await sendFcmNotification({
          tokens,
          channel: FCM_CHANNELS.GENERAL,
          title: 'Shop Application Rejected',
          body: `Your shop "${data.shopName}" application was rejected. Reason: ${data.reason}`,
          data: { type: 'SHOP_REJECTED', shopName: data.shopName, reason: data.reason },
        });
        logger.info('FCM push sent', {
          jobName: data.jobName,
          vendorId: data.vendorId,
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenCount: result.invalidTokens.length,
        });
        if (result.invalidTokens.length)
          await pruneVendorTokens(result.invalidTokens, data.jobName);
      }
      break;
    }

    default: {
      const exhaustiveCheck: never = data;
      logger.warn('Unknown notification job', { data: exhaustiveCheck });
    }
  }
}

// ─── Worker startup ───────────────────────────────────────────────────────────

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
        stack: err.stack,
      });
    });

    worker.on('error', (err) => {
      logger.error('Notification worker error', { error: err.message, stack: err.stack });
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
