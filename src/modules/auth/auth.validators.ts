import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .length(10, 'Enter valid 10-digit mobile number')
    .regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile number'),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .length(10, 'Enter valid 10-digit mobile number')
    .regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile number'),
  otp: z
    .string()
    .length(6, 'Enter 6-digit OTP')
    .regex(/^\d{6}$/, 'Enter 6-digit OTP'),
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const completeProfileSchema = z.object({
  name: z.string().min(2, 'Enter valid name').max(50, 'Enter valid name').trim(),
  email: z.string().email('Enter valid email').optional().or(z.literal('')),
});
