import { z } from 'zod';

import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './upload.constants';

export const generateUploadUrlSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    message: 'Only image/jpeg, image/png, and image/webp are allowed',
  }),
  fileSizeBytes: z
    .number({ message: 'File size must be a number' })
    .int('File size must be an integer')
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE_BYTES, 'File size must not exceed 10MB'),
});

export const verifyUploadSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  key: z.string().min(1, 'Key is required'),
});
