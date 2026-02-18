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
