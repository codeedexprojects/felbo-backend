import { z } from 'zod';

export const createIssueSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  shopId: z.string().min(1, 'Shop ID is required'),
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
    lat: z.number({ message: 'Latitude is required' }),
    lng: z.number({ message: 'Longitude is required' }),
  }),
  photoUrl: z.string().min(1).optional(),
  razorpayPaymentId: z.string().min(1).optional(),
});

export const issueIdParamSchema = z.object({
  id: z.string().min(1, 'Issue ID is required'),
});

export const updateIssueStatusSchema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  reason: z.string().min(1, 'Reason/Note is required').max(500, 'Reason too long'),
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
