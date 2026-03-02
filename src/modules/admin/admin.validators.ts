import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const listVendorsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  registrationType: z.enum(['ASSOCIATION', 'INDEPENDENT']).optional(),
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

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const userIdParamSchema = z.object({
  id: mongoIdSchema,
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
  search: z.string().min(1).optional(),
});

export const blockUserSchema = z.object({
  reason: z.string().min(1, 'Block reason is required').max(500, 'Reason too long'),
});
