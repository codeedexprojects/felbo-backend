import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const shopIdOnboardingParamSchema = z.object({
  shopId: z
    .string()
    .min(1, 'Shop ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID'),
});

export const addServiceSchema = z.object({
  categoryId: mongoIdSchema,
  name: z.string().min(1, 'Service name is required').max(100),
  basePrice: z.number().positive('Base price must be positive'),
  baseDurationMinutes: z.number().int().positive('Duration must be a positive integer (minutes)'),
  applicableFor: z.enum(['MENS', 'WOMENS', 'ALL']),
  description: z.string().max(500).optional(),
});

export const updateServiceSchema = z
  .object({
    name: z.string().min(1, 'Service name is required').max(100).optional(),
    basePrice: z.number().positive('Enter valid price').optional(),
    baseDurationMinutes: z
      .number()
      .int()
      .min(5, 'Duration must be 5-180 minutes')
      .max(180, 'Duration must be 5-180 minutes')
      .optional(),
    applicableFor: z.enum(['MENS', 'WOMENS', 'ALL']).optional(),
    description: z.string().max(500).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field is required for update.',
  });

export const serviceIdParamSchema = z.object({
  shopId: mongoIdSchema,
  serviceId: mongoIdSchema,
});

export const assignServicesSchema = z.object({
  services: z
    .array(
      z.object({
        serviceId: mongoIdSchema,
        price: z.number().positive('Enter valid price'),
        durationMinutes: z
          .number()
          .int()
          .min(5, 'Duration must be 5-180 minutes')
          .max(180, 'Duration must be 5-180 minutes'),
      }),
    )
    .min(1, 'At least one service is required'),
});

export const barberServiceParamSchema = z.object({
  barberId: mongoIdSchema,
  serviceId: mongoIdSchema,
});

export const barberIdParamSchema = z.object({
  barberId: mongoIdSchema,
});
