import { z } from 'zod';

const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  area: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().length(6),
});

const locationSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});

const dayHoursSchema = z.object({
  open: z.string().min(1),
  close: z.string().min(1),
  isOpen: z.boolean(),
});

const workingHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const createShopSchema = z.object({
  name: z.string().min(1, 'Shop name is required').max(100),
  shopType: z.enum(['MENS', 'WOMENS', 'UNISEX']),
  phone: z
    .string()
    .length(10, 'Enter a valid 10-digit mobile number')
    .regex(/^[6-9]\d{9}$/),
  address: addressSchema,
  location: locationSchema,
  photos: z.array(z.string().url()).max(10).optional(),
});

export const updateShopSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  shopType: z.enum(['MENS', 'WOMENS', 'UNISEX']).optional(),
  address: addressSchema.optional(),
  location: locationSchema.optional(),
  photos: z.array(z.string().url()).max(10).optional(),
});

export const toggleAvailableSchema = z.object({
  isAvailable: z.boolean(),
});

export const updateWorkingHoursSchema = z.object({
  workingHours: workingHoursSchema,
});

export const nearbyShopsSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  maxDistanceMeters: z.coerce.number().positive().optional(),
  shopType: z.enum(['MENS', 'WOMENS', 'UNISEX']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const searchShopsSchema = z.object({
  query: z.string().min(1).optional(),
  shopType: z.enum(['MENS', 'WOMENS', 'UNISEX']).optional(),
  categoryId: mongoIdSchema.optional(),
  categoryName: z.string().min(1).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceMeters: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const shopIdParamSchema = z.object({
  id: mongoIdSchema,
});

export const shopDetailsQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const shopIdOnboardingParamSchema = z.object({
  shopId: z
    .string()
    .min(1, 'Shop ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID'),
});

export const completeProfileSchema = z.object({
  description: z.string().min(1, 'Description is required').max(1000),
  workingHours: workingHoursSchema,
  photos: z.array(z.string().url()).min(1, 'At least one photo is required').max(10),
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

export const addBarberSchema = z.object({
  name: z.string().min(2, 'Barber name must be at least 2 characters').max(100),
  phone: z
    .string()
    .length(10, 'Enter valid 10-digit mobile number')
    .regex(/^[6-9]\d{9}$/),
  photo: z.string().url().optional(),
  services: z
    .array(
      z.object({
        serviceId: mongoIdSchema,
        price: z.number().positive('Price must be positive'),
        durationMinutes: z.number().int().positive('Duration must be a positive integer (minutes)'),
      }),
    )
    .min(1, 'At least one service is required'),
});
