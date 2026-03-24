import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  image: z.string().min(1, 'Image is required'),
  date: z.coerce.date().optional(),
});

export const updateEventSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(500).optional(),
    image: z.string().min(1).optional(),
    date: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const eventIdParamSchema = z.object({
  id: mongoIdSchema,
});

export const listEventsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
