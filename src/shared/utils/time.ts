import { toZonedTime } from 'date-fns-tz';

export const SHOP_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstDayRangeUtc(): { start: Date; end: Date } {
  const nowInIst = toZonedTime(new Date(), SHOP_TIMEZONE);
  const startMs =
    Date.UTC(nowInIst.getFullYear(), nowInIst.getMonth(), nowInIst.getDate()) - IST_OFFSET_MS;
  return {
    start: new Date(startMs),
    end: new Date(startMs + 24 * 60 * 60 * 1000),
  };
}

export function getTodayInIst(): Date {
  const nowInIst = toZonedTime(new Date(), SHOP_TIMEZONE);
  return new Date(Date.UTC(nowInIst.getFullYear(), nowInIst.getMonth(), nowInIst.getDate()));
}

export function getCurrentIstDate(): Date {
  return toZonedTime(new Date(), SHOP_TIMEZONE);
}

export function getCurrentIstMinutes(): number {
  const nowInIst = getCurrentIstDate();
  return nowInIst.getHours() * 60 + nowInIst.getMinutes();
}

export function parseDateAsIst(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Combines a booking date (stored as UTC midnight of IST calendar date)
 * with a startTime string ("HH:MM" in IST) to produce the real UTC appointment Date.
 */
export function buildAppointmentDate(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number);
  return new Date(date.getTime() - IST_OFFSET_MS + (h * 60 + m) * 60_000);
}

/** Converts "HH:MM" (24-hour IST) to "H:MM AM/PM" display string. */
export function formatAppointmentTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}
