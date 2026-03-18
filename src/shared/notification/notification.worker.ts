import { Worker, Job } from 'bullmq';
import { connectMongo } from '../database/mongo';
import { initFirebase, sendFcmNotification, FCM_CHANNELS } from './fcm.service';
import { synthesiseMalayalamSpeech, buildBookingTtsText } from './tts.service';
import { NotificationJobData } from './notification.queue';
import { getBullConnection, QUEUE_NAMES } from '../queue/bull';
import { logger } from '../logger/logger';
import { UserModel } from '../../modules/user/user.model';
import { VendorModel } from '../../modules/vendor/vendor.model';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  await connectMongo();
  initFirebase();
  logger.info('Notification worker started');
}

// ─── Token helpers ────────────────────────────────────────────────────────────
// These are the ONLY DB queries the worker makes. Everything else was
// denormalised at enqueue time.

async function getUserTokens(userId: string): Promise<string[]> {
  const user = await UserModel.findById(userId, { fcmTokens: 1 }).lean();
  return user?.fcmTokens ?? [];
}

async function getVendorTokens(vendorId: string): Promise<string[]> {
  const vendor = await VendorModel.findById(vendorId, { fcmTokens: 1 }).lean();
  return vendor?.fcmTokens ?? [];
}

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

// ─── Job processor ────────────────────────────────────────────────────────────

async function processJob(job: Job<NotificationJobData>): Promise<void> {
  const { data } = job;
  logger.info('Processing notification job', { jobName: data.jobName, jobId: job.id });

  switch (data.jobName) {
    // ── User: booking confirmed ──────────────────────────────────────────────
    case 'BOOKING_CONFIRMED_USER': {
      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) return;

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.BOOKING,
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

    // ── User: booking cancelled by vendor ────────────────────────────────────
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

    // ── User: booking cancelled by user (their own cancellation confirmation) ─
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

    // ── User: reminder (1hr and 30min share same handler) ───────────────────
    case 'REMINDER_1HR':
    case 'REMINDER_30MIN': {
      const tokens = await getUserTokens(data.userId);
      if (!tokens.length) return;

      const timeLabel = data.jobName === 'REMINDER_1HR' ? '1 hour' : '30 minutes';

      const result = await sendFcmNotification({
        tokens,
        // Reminders get their own channel with a softer, distinct sound
        channel: FCM_CHANNELS.REMINDER,
        title: 'Appointment Reminder',
        body: `Your appointment at ${data.shopName} is in ${timeLabel}`,
        data: {
          type: 'REMINDER',
          shopName: data.shopName,
          minutesBefore: data.jobName === 'REMINDER_1HR' ? '60' : '30',
        },
      });

      if (result.invalidTokens.length) await pruneUserTokens(result.invalidTokens);
      logger.info(`${data.jobName} sent`, result);
      break;
    }

    // ── User: review prompt ──────────────────────────────────────────────────
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

    // ── Vendor: new booking (loud alert + optional TTS) ──────────────────────
    case 'NEW_BOOKING_VENDOR': {
      const tokens = await getVendorTokens(data.vendorId);
      if (!tokens.length) return;

      // Build FCM data payload. Flutter uses these fields to:
      //   1. Play the booking_alert sound via the felbo_booking channel
      //   2. Show the TTS readout if audioUrl is present
      //   3. Read aloud using flutter_tts if the app is in foreground (ttsText fallback)
      const fcmData: Record<string, string> = {
        type: 'NEW_BOOKING',
        customerName: data.customerName,
        serviceName: data.serviceName,
        appointmentTime: data.appointmentTime,
        // Flutter uses ttsText for in-app TTS (app open/background, no audio file needed)
        ttsText: buildBookingTtsText(data.customerName, data.serviceName, data.appointmentTime),
      };

      // Generate TTS audio only when voiceAnnouncements is enabled.
      // The audio file is for the case where the app is in the background/killed
      // and Flutter can't run TTS locally — it streams our pre-generated MP3.
      if (data.voiceEnabled) {
        try {
          const ttsText = buildBookingTtsText(
            data.customerName,
            data.serviceName,
            data.appointmentTime,
          );
          const { audioUrl } = await synthesiseMalayalamSpeech(ttsText);
          // Flutter checks for audioUrl in FCM data. If present and app is backgrounded,
          // it downloads and plays via platform audio player.
          fcmData.audioUrl = audioUrl;
        } catch (ttsErr) {
          // TTS failure must never block the push notification itself.
          // The vendor will still get the visual notification and ttsText fallback.
          logger.error('TTS generation failed, sending notification without audio', {
            vendorId: data.vendorId,
            error: (ttsErr as Error).message,
          });
        }
      }

      const result = await sendFcmNotification({
        tokens,
        channel: FCM_CHANNELS.BOOKING, // loud distinct sound
        title: `New Booking from ${data.customerName}`,
        body: `${data.serviceName} at ${data.appointmentTime}`,
        data: fcmData,
      });

      if (result.invalidTokens.length) await pruneVendorTokens(result.invalidTokens);
      logger.info('NEW_BOOKING_VENDOR sent', { ...result, voiceEnabled: data.voiceEnabled });
      break;
    }

    // ── Vendor: customer cancelled ────────────────────────────────────────────
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

    // ── Vendor: cancellation warning ──────────────────────────────────────────
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

    // ── Vendor: account suspended ─────────────────────────────────────────────
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

    // ── Vendor: account reactivated ───────────────────────────────────────────
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
