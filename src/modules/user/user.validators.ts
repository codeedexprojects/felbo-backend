import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z
    .string({ error: 'Phone number is required' })
    .length(10, 'Enter valid 10-digit mobile number')
    .regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile number'),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string({ error: 'Phone number is required' })
    .length(10, 'Enter valid 10-digit mobile number')
    .regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile number'),
  otp: z
    .string({ error: 'OTP is required' })
    .length(6, 'Enter 6-digit OTP')
    .regex(/^\d{6}$/, 'Enter 6-digit OTP'),
  sessionId: z.string({ error: 'Session ID is required' }).min(1, 'Session ID is required'),
  fcmToken: z.string().min(1).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Enter valid name').max(50, 'Enter valid name').trim().optional(),
  email: z.email('Enter valid email').optional().or(z.literal('')),
  profileUrl: z.url('Enter valid profile URL').optional(),
  gender: z
    .enum(['MALE', 'FEMALE', 'OTHER'], { error: 'Gender must be MALE, FEMALE, or OTHER' })
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});

export const fcmTokenSchema = z.object({
  token: z.string({ error: 'Token is required' }).min(1, 'Token is required'),
});

// ─── Admin user management ───────────────────────────────────────────────────

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const userIdParamSchema = z.object({ id: mongoIdSchema });

export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
  search: z.string().min(1).optional(),
});

export const blockUserSchema = z.object({
  reason: z.string().min(1, 'Block reason is required').max(500, 'Reason too long'),
});

export const userBookingsPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
