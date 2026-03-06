import { toZonedTime } from 'date-fns-tz';

export const SHOP_TIMEZONE = 'Asia/Kolkata';

export function getTodayInIst(): Date {
  const nowInIst = toZonedTime(new Date(), SHOP_TIMEZONE);
  return new Date(Date.UTC(nowInIst.getFullYear(), nowInIst.getMonth(), nowInIst.getDate()));
}

export function getCurrentIstMinutes(): number {
  const nowInIst = toZonedTime(new Date(), SHOP_TIMEZONE);
  return nowInIst.getHours() * 60 + nowInIst.getMinutes();
}

export function parseDateAsIst(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
