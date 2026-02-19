import { z } from 'zod';

export const issueIdParamSchema = z.object({
  id: z.string().min(1, 'Issue ID is required'),
});

export const listIssuesSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  status: z.enum(['OPEN', 'RESOLVED', 'REJECTED']).optional(),
  type: z
    .enum(['SHOP_CLOSED', 'BARBER_UNAVAILABLE', 'SERVICE_NOT_PROVIDED', 'QUALITY_ISSUE', 'OTHER'])
    .optional(),
});
