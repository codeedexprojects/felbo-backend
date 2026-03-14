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
    .max(10, 'Cannot book more than 10 services at once'),
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
  reason: z.enum(['BARBER_SICK', 'EMERGENCY', 'SHOP_CLOSING', 'EQUIPMENT_ISSUE', 'OTHER']),
});

export const barberBookingListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z
    .enum(['CONFIRMED', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_VENDOR', 'NO_SHOW'])
    .optional(),
});

export const cancelBookingByUserBodySchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

export const completeBookingBodySchema = z.object({
  verificationCode: z.string().regex(/^\d{4}$/, 'verificationCode must be a 4-digit number'),
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
