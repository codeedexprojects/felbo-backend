import cron from 'node-cron';
import { BookingModel } from '../modules/booking/booking.model';
import { SlotBlockModel } from '../modules/barber/barber.model';
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
      { $set: { status: 'COMPLETED', completedAt: now } },
    );

    const bookingToday = await BookingModel.updateMany(
      {
        status: 'CONFIRMED',
        date: { $gte: todayStart, $lt: todayEnd },
        endTime: { $lte: currentTimeIST },
      },
      { $set: { status: 'COMPLETED', completedAt: now } },
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

    const bookingsHealed = bookingPast.modifiedCount + bookingToday.modifiedCount;
    const slotBlocksHealed = slotPast.modifiedCount + slotToday.modifiedCount;

    if (bookingsHealed > 0 || slotBlocksHealed > 0) {
      logger.info({ action: 'STATUS_HEALER_RUN', bookingsHealed, slotBlocksHealed });
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
