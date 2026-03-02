import { z } from 'zod';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './upload.constants';

// Upload URL request: just mimeType + fileSizeBytes — no vendorId needed (taken from JWT)
export const uploadBodySchema = z.object({
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    message: 'Only image/jpeg, image/png, and image/webp are allowed',
  }),
  fileSizeBytes: z
    .number({ message: 'File size must be a number' })
    .int('File size must be an integer')
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE_BYTES, 'File size must not exceed 10MB'),
});

// Verify request: just the S3 key — prefix ownership is validated in the controller
export const verifyKeySchema = z.object({
  key: z.string().min(1, 'Key is required'),
});
