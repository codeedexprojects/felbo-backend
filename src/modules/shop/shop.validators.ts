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

export const updateShopSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  shopType: z.enum(['MENS', 'WOMENS', 'UNISEX']).optional(),
  address: addressSchema.optional(),
  location: locationSchema.optional(),
  photos: z.array(z.string().url()).max(10).optional(),
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
  query: z.string().min(1),
  city: z.string().optional(),
  shopType: z.enum(['MENS', 'WOMENS', 'UNISEX']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const shopIdParamSchema = z.object({
  id: z.string().min(1),
});

export const shopIdOnboardingParamSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required'),
});

export const completeProfileSchema = z.object({
  description: z.string().min(1, 'Description is required').max(1000),
  workingHours: workingHoursSchema,
  photos: z.array(z.string().url()).min(1, 'At least one photo is required').max(10),
});

export const addServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100),
  basePrice: z.number().positive('Base price must be positive'),
  baseDuration: z.number().int().positive('Duration must be a positive integer (minutes)'),
  description: z.string().max(500).optional(),
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
        serviceId: z.string().min(1, 'Service ID is required'),
        duration: z.number().int().positive('Duration must be a positive integer (minutes)'),
      }),
    )
    .min(1, 'At least one service is required'),
});
