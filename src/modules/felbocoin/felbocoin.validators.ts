import { z } from 'zod';

const pageLimit = {
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
};

export const felboCoinTransactionsQuerySchema = z.object(pageLimit);

export const adminCoinActionSchema = z.object({
  coins: z.number().int().min(1).max(10000),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(200),
});

export const adminStatsQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const adminTransactionsQuerySchema = z.object({
  ...pageLimit,
  search: z.string().optional(),
  type: z
    .enum([
      'COIN_EARNED',
      'COIN_REDEEMED',
      'COIN_REFUND',
      'COIN_REVERSAL',
      'ADMIN_CREDIT',
      'ADMIN_DEBIT',
    ])
    .optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const adminTrendQuerySchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  granularity: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('daily'),
});

export const adminLeaderboardQuerySchema = z.object(pageLimit);

export const adminLogsQuerySchema = z.object(pageLimit);

export const userIdParamSchema = z.object({
  userId: z.string().min(1),
});
