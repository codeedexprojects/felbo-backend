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
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Enter valid name').max(50, 'Enter valid name').trim().optional(),
  email: z.string().email('Enter valid email').optional().or(z.literal('')),
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});
