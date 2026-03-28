import { z } from 'zod';
import { toZonedTime } from 'date-fns-tz';
import { ValidationError } from '../../shared/errors';

const IST_TIMEZONE = 'Asia/Kolkata';

export function resolveDateRange(
  period: string,
  from?: string,
  to?: string,
): { from: Date; to: Date } {
  const now = new Date();
  const ist = toZonedTime(now, IST_TIMEZONE);

  function istMidnight(y: number, m: number, d: number): Date {
    return new Date(Date.UTC(y, m, d));
  }

  if (period === 'custom') {
    if (!from || !to) {
      throw new ValidationError('Both from and to are required for custom period.');
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD.');
    }
    if (fromDate > toDate) {
      throw new ValidationError('from must be before to.');
    }
    // to: end of day IST
    toDate.setUTCHours(18, 29, 59, 999); // 23:59:59 IST = 18:29:59 UTC
    return { from: fromDate, to: toDate };
  }

  if (period === 'today') {
    const start = istMidnight(ist.getFullYear(), ist.getMonth(), ist.getDate());
    return { from: start, to: now };
  }

  if (period === 'week') {
    const dayOfWeek = ist.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(ist);
    monday.setDate(monday.getDate() - daysToMonday);
    const start = istMidnight(monday.getFullYear(), monday.getMonth(), monday.getDate());
    return { from: start, to: now };
  }

  // month (default)
  const start = istMidnight(ist.getFullYear(), ist.getMonth(), 1);
  return { from: start, to: now };
}

const basePeriodSchema = z.object({
  period: z.enum(['today', 'week', 'month', 'custom']).optional().default('month'),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const financeChartSchema = basePeriodSchema;

export const refundHistorySchema = z.object({
  type: z.enum(['ISSUE', 'CANCELLATION', 'COIN']).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const independentRegListSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAYMENT_PENDING']).optional(),
});

export const financeVendorTableSchema = basePeriodSchema.extend({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  minRevenue: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),
  maxRevenue: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),
});
