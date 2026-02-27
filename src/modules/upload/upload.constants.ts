export const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AllowedMimeType = keyof typeof MIME_TO_EXT;

export const ALLOWED_MIME_TYPES = Object.keys(MIME_TO_EXT) as AllowedMimeType[];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const PRESIGNED_PUT_EXPIRY_SECONDS = 300; // 5 minutes
export const PRESIGNED_GET_EXPIRY_SECONDS = 3600; // 1 hour
export const CLEANUP_AGE_HOURS = 24;

export const S3_DELETE_BATCH_SIZE = 1000;
export const S3_VENDORS_PREFIX = 'vendors/';
