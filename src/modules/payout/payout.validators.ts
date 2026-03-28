import { z } from 'zod';
import { Types } from 'mongoose';

export const payoutListSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']).optional(),
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
});

export const payoutIdParamSchema = z.object({
  id: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid payout ID' }),
});

export const rejectPayoutBodySchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required').max(500),
});
