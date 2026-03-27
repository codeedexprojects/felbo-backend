import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

export const shopIdParamSchema = z.object({
  shopId: mongoIdSchema,
});

export const getBarbersForServicesQuerySchema = z.object({
  serviceIds: z
    .string()
    .min(1, 'serviceIds is required')
    .refine(
      (val) => val.split(',').every((id) => /^[0-9a-fA-F]{24}$/.test(id.trim())),
      'serviceIds must be comma-separated valid IDs',
    ),
});

export const getSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  serviceIds: z
    .string()
    .min(1, 'serviceIds is required')
    .refine(
      (val) => val.split(',').every((id) => /^[0-9a-fA-F]{24}$/.test(id.trim())),
      'serviceIds must be comma-separated valid IDs',
    ),
  barberId: mongoIdSchema,
});

export const initiateBookingBodySchema = z.object({
  shopId: mongoIdSchema,
  barberId: mongoIdSchema,
  serviceIds: z
    .array(mongoIdSchema)
    .min(1, 'At least one service is required')
    .max(10, 'Too many services selected'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be in HH:mm format'),
  paymentMethod: z.enum(['RAZORPAY', 'FELBO_COINS']),
});

export const bookingIdParamSchema = z.object({
  bookingId: mongoIdSchema,
});

export const confirmBookingBodySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const cancelBookingByBarberBodySchema = z.object({
  reason: z.string().min(5, 'Reason is required').max(150),
});

export const barberBookingListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});

export const cancelBookingByUserBodySchema = z.object({
  reason: z.string().min(5, 'Reason is required').max(150),
});

export const completeBookingBodySchema = z.object({
  verificationCode: z.string().regex(/^\d{4}$/, 'verificationCode must be a 4-digit number'),
});

export const markNoShowBodySchema = z.object({});

export const userBookingListQuerySchema = z.object({
  tab: z.enum(['upcoming', 'completed', 'cancelled']).default('upcoming'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});

export const adminCancellationListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  cancelledBy: z.enum(['USER', 'VENDOR']).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});

export const adminBookingListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z
    .enum([
      'PENDING_PAYMENT',
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED_BY_USER',
      'CANCELLED_BY_VENDOR',
      'NO_SHOW',
    ])
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});

export const adminBookingStatsQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'year', 'custom']).default('day'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .optional(),
  })
  .refine((data) => data.period !== 'custom' || (!!data.startDate && !!data.endDate), {
    message: 'startDate and endDate are required when period is custom.',
  });

export const vendorIdParamSchema = z.object({
  id: mongoIdSchema,
});

export const adminVendorBookingListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  status: z
    .enum(['CONFIRMED', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_VENDOR', 'NO_SHOW'])
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});
