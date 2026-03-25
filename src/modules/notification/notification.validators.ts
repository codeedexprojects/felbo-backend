import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const listNotificationsSchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  cursor: z.string().datetime().optional(),
});

export const notificationIdParamSchema = z.object({
  id: mongoIdSchema,
});
