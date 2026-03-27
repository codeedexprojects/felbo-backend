import cron from 'node-cron';
import { BookingModel } from '../modules/booking/booking.model';
import { SlotBlockModel } from '../modules/barber/barber.model';
import { PaymentModel } from '../modules/payment/payment.model';
import { logger } from '../shared/logger/logger';
import { getIstDayRangeUtc, getCurrentIstDate } from '../shared/utils/time';

let isRunning = false;

async function healStatuses(): Promise<void> {
  if (isRunning) {
    logger.warn({ action: 'STATUS_HEALER_SKIP', reason: 'Previous run still in progress' });
    return;
  }

  isRunning = true;
  try {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = getIstDayRangeUtc();
    const nowIST = getCurrentIstDate();
    const hh = String(nowIST.getHours()).padStart(2, '0');
    const mm = String(nowIST.getMinutes()).padStart(2, '0');
    const currentTimeIST = `${hh}:${mm}`;

    const bookingPast = await BookingModel.updateMany(
      { status: 'CONFIRMED', date: { $lt: todayStart } },
      { $set: { status: 'COMPLETED', completedAt: now, completedBy: 'SYSTEM' } },
    );

    const bookingToday = await BookingModel.updateMany(
      {
        status: 'CONFIRMED',
        date: { $gte: todayStart, $lt: todayEnd },
        endTime: { $lte: currentTimeIST },
      },
      { $set: { status: 'COMPLETED', completedAt: now, completedBy: 'SYSTEM' } },
    );

    const slotPast = await SlotBlockModel.updateMany(
      { status: 'ACTIVE', date: { $lt: todayStart } },
      { $set: { status: 'RELEASED', releasedAt: now } },
    );

    const slotToday = await SlotBlockModel.updateMany(
      {
        status: 'ACTIVE',
        date: { $gte: todayStart, $lt: todayEnd },
        endTime: { $lte: currentTimeIST },
      },
      { $set: { status: 'RELEASED', releasedAt: now } },
    );

    // --- Stale PENDING_PAYMENT cleanup ---
    const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);

    const staleBookings = await BookingModel.find(
      { status: 'PENDING_PAYMENT', createdAt: { $lt: staleThreshold } },
      { _id: 1, razorpayOrderId: 1 },
    ).lean();

    let stalePendingCancelled = 0;

    if (staleBookings.length > 0) {
      const staleIds = staleBookings.map((b) => b._id);
      const staleOrderIds = staleBookings
        .map((b) => b.razorpayOrderId)
        .filter((id): id is string => !!id);

      if (staleOrderIds.length > 0) {
        await PaymentModel.updateMany(
          { razorpayOrderId: { $in: staleOrderIds }, status: 'CREATED' },
          { $set: { status: 'FAILED' } },
        );
      }
      const stalePendingResult = await BookingModel.updateMany(
        { _id: { $in: staleIds }, status: 'PENDING_PAYMENT' },
        { $set: { status: 'CANCELLED_BY_USER' } },
      );

      stalePendingCancelled = stalePendingResult.modifiedCount;
    }

    const bookingsHealed = bookingPast.modifiedCount + bookingToday.modifiedCount;
    const slotBlocksHealed = slotPast.modifiedCount + slotToday.modifiedCount;

    if (bookingsHealed > 0 || slotBlocksHealed > 0 || stalePendingCancelled > 0) {
      logger.info({
        action: 'STATUS_HEALER_RUN',
        bookingsHealed,
        slotBlocksHealed,
        stalePendingCancelled,
      });
    }
  } catch (err) {
    logger.error({ action: 'STATUS_HEALER_ERROR', err });
  } finally {
    isRunning = false;
  }
}

export function scheduleStatusHealer(): void {
  cron.schedule('*/2 * * * *', () => void healStatuses(), { timezone: 'Asia/Kolkata' });
  logger.info({ action: 'STATUS_HEALER_SCHEDULED', module: 'cron', interval: '*/2 * * * *' });
}
