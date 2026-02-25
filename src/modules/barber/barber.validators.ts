import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

const phoneSchema = z
  .string()
  .length(10, 'Enter a valid 10-digit mobile number')
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50)
  .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, or underscores');

export const createBarberSchema = z.object({
  shopId: mongoIdSchema,
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: phoneSchema,
  photo: z.string().optional(),
  username: usernameSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateBarberSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    phone: phoneSchema.optional(),
    photo: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field is required for update.',
  });

export const updateCredentialsSchema = z
  .object({
    username: usernameSchema.optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  })
  .refine((data) => data.username !== undefined || data.password !== undefined, {
    message: 'Provide username or password to update.',
  });

export const barberIdParamSchema = z.object({
  barberId: mongoIdSchema,
});

export const shopIdParamSchema = z.object({
  shopId: mongoIdSchema,
});

export const listBarberQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

// Onboarding: add barber with service assignments during shop setup
export const onboardBarberSchema = z.object({
  name: z.string().min(2, 'Barber name must be at least 2 characters').max(100),
  phone: phoneSchema,
  photo: z.string().optional(),
  services: z
    .array(
      z.object({
        serviceId: mongoIdSchema,
        price: z.number().positive('Price must be positive'),
        durationMinutes: z.number().int().positive('Duration must be a positive integer (minutes)'),
      }),
    )
    .min(1, 'At least one service is required'),
});
