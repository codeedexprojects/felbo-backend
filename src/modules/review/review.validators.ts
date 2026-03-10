import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const submitReviewSchema = z.object({
  bookingId: mongoIdSchema,
  rating: z
    .number({ message: 'Rating must be a number' })
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  description: z.string().max(150, 'Description must not exceed 150 characters').optional(),
});

export const shopIdParamSchema = z.object({
  shopId: mongoIdSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
