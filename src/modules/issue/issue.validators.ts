import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createIssueSchema = z.object({
  bookingId: objectIdSchema,
  shopId: objectIdSchema,
  type: z.enum([
    'SHOP_CLOSED',
    'BARBER_UNAVAILABLE',
    'EXCESSIVE_WAIT',
    'SERVICE_NOT_PROVIDED',
    'QUALITY_ISSUE',
    'OTHER',
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  userLocation: z.object({
    lat: z
      .number()
      .gte(-90, 'Latitude must be between -90 and 90')
      .lte(90, 'Latitude must be between -90 and 90'),
    lng: z
      .number()
      .gte(-180, 'Longitude must be between -180 and 180')
      .lte(180, 'Longitude must be between -180 and 180'),
  }),
  razorpayPaymentId: z.string().min(1).optional(),
});

export const issueIdParamSchema = z.object({
  id: z.string().min(1, 'Issue ID is required'),
});

export const updateIssueStatusSchema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  reason: z.string().min(1, 'Reason/Note is required').max(500, 'Reason too long'),
});

export const userIssueListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});

export const listIssuesSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  status: z.enum(['OPEN', 'RESOLVED', 'REJECTED']).optional(),
  type: z
    .enum([
      'SHOP_CLOSED',
      'BARBER_UNAVAILABLE',
      'EXCESSIVE_WAIT',
      'SERVICE_NOT_PROVIDED',
      'QUALITY_ISSUE',
      'OTHER',
    ])
    .optional(),
});
