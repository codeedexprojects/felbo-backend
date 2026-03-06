import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

export const shopIdParamSchema = z.object({
  shopId: mongoIdSchema,
});

export const getSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  serviceIds: z
    .string()
    .min(1, 'serviceIds is required')
    .refine(
      (val) => val.split(',').every((id) => /^[0-9a-fA-F]{24}$/.test(id.trim())),
      'serviceIds must be comma-separated valid IDs',
    ),
  barberId: mongoIdSchema,
});
