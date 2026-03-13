import { z } from 'zod';

const phoneSchema = z
  .string()
  .length(10, 'Enter valid 10-digit mobile number')
  .regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile number');

const otpSchema = z
  .string()
  .length(6, 'Enter 6-digit OTP')
  .regex(/^\d{6}$/, 'Enter 6-digit OTP');

const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  area: z.string().min(1, 'Area is required'),
  city: z.string().min(1, 'City is required'),
  district: z.string().min(1, 'District is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z
    .string()
    .length(6, 'Enter valid 6-digit pincode')
    .regex(/^\d{6}$/, 'Enter valid 6-digit pincode'),
});

const locationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

const shopDetailsSchema = z.object({
  name: z
    .string()
    .min(2, 'Shop name must be at least 2 characters')
    .max(100, 'Shop name must be at most 100 characters'),
  type: z.enum(['MENS', 'WOMENS', 'UNISEX']),
  address: addressSchema,
  location: locationSchema,
  photos: z.array(z.string().url('Enter valid image URL')).optional().default([]),
});

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const loginVerifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const registerVerifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const registerAssociationSchema = z.object({
  phone: phoneSchema,
  ownerName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z.string().email('Enter valid email').optional(),
  associationMemberId: z.string().min(1, 'Member ID is required'),
  associationIdProofUrl: z.string().url('Enter valid URL for ID proof'),
  shopDetails: shopDetailsSchema,
});

export const registerIndependentInitiateSchema = z.object({
  phone: phoneSchema,
  ownerName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z.string().email('Enter valid email').optional(),
  documents: z.object({
    shopLicense: z.string().url('Enter valid URL for shop license'),
    ownerIdProof: z.string().url('Enter valid URL for owner ID proof'),
  }),
  shopDetails: shopDetailsSchema,
});

export const registerIndependentConfirmSchema = z.object({
  phone: phoneSchema,
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Signature is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const fcmTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const updateProfileSchema = z
  .object({
    ownerName: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters')
      .optional(),
    email: z.string().email('Enter valid email').optional(),
    profilePhoto: z.string().url('Enter valid image URL').optional(),
  })
  .refine(
    (data) =>
      data.ownerName !== undefined || data.email !== undefined || data.profilePhoto !== undefined,
    {
      message: 'At least one field (ownerName, email or profilePhoto) must be provided',
    },
  );

export const dashboardStatsQuerySchema = z.object({
  shopId: z.string().min(1).optional(),
});

export const vendorBookingsQuerySchema = z.object({
  shopId: z.string().min(1).optional(),
  status: z
    .enum([
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED_BY_USER',
      'CANCELLED_BY_VENDOR',
      'NO_SHOW',
      'CANCELLED',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
