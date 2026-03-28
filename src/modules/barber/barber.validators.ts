import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

const phoneSchema = z
  .string()
  .length(10, 'Enter a valid 10-digit mobile number')
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const createBarberSchema = z.object({
  shopId: mongoIdSchema,
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: phoneSchema,
  email: z.string().email('Enter a valid email address'),
  photo: z.string().optional(),
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
    username: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, or underscores')
      .optional(),
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
  isAvailable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  status: z.enum(['INACTIVE', 'ACTIVE', 'DELETED']).optional(),
});

export const onboardBarberSchema = z.object({
  name: z.string().min(2, 'Barber name must be at least 2 characters').max(100),
  phone: phoneSchema,
  email: z.string().email('Enter a valid email address'),
  photo: z.string().optional(),
});

export const addBarberServicesSchema = z.object({
  services: z
    .array(
      z.object({
        serviceId: mongoIdSchema,
        durationMinutes: z.number().int().positive('Duration must be a positive integer (minutes)'),
      }),
    )
    .min(1, 'At least one service is required'),
});

export const barberShopParamSchema = z.object({
  shopId: mongoIdSchema,
  barberId: mongoIdSchema,
});

export const barberSendOtpSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const barberVerifyOtpSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const barberSetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const barberLoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  fcmToken: z.string().min(1).optional(),
});

export const barberRefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const addSelfAsBarberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: phoneSchema,
  photo: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
});

export const createSlotBlockSchema = z.object({
  serviceIds: z.array(mongoIdSchema).max(10, 'Too many services').optional(),

  reason: z.string().trim().min(1, 'Reason cannot be blank').max(200, 'Reason too long').optional(),
});

export const releaseSlotBlockParamSchema = z.object({
  blockId: mongoIdSchema,
});

export const listSlotBlocksQuerySchema = z.object({
  date: z.string().date('Invalid date format. Use YYYY-MM-DD').optional(),
  status: z.enum(['ACTIVE', 'RELEASED']).optional(),
});

export const fcmTokenSchema = z.object({
  token: z.string({ error: 'Token is required' }).min(1, 'Token is required'),
});
