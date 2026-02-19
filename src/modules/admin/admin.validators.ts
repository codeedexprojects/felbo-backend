import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const listVendorsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  search: z.string().optional(),
});

export const rejectVendorSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500, 'Reason too long'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const vendorIdParamSchema = z.object({
  id: z.string().min(1),
});
