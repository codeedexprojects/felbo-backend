import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const createAdSchema = z.object({
  title: z.string().min(1, 'Title is required').max(32),
  subtitle: z.string().min(1, 'Subtitle is required').max(20),
  description: z.string().min(1, 'Description is required').max(250),
  bannerImage: z.string().min(1, 'Banner image is required'),
  shopId: mongoIdSchema,
  priority: z.number().int().min(0, 'Priority must be 0 or higher').optional(),
});

export const updateAdSchema = z
  .object({
    title: z.string().min(1).max(32).optional(),
    subtitle: z.string().min(1).max(20).optional(),
    description: z.string().min(1).max(250).optional(),
    bannerImage: z.string().min(1).optional(),
    shopId: mongoIdSchema.optional(),
    priority: z.number().int().min(0, 'Priority must be 0 or higher').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const adIdParamSchema = z.object({
  id: mongoIdSchema,
});

export const listAdsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
