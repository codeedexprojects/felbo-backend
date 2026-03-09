import { z } from 'zod';

export const categoryParamSchema = z.object({
  category: z.string().min(1, 'Category is required'),
});

export const keyParamSchema = z.object({
  key: z.string().min(1, 'Key is required'),
});

export const updateConfigSchema = z.object({
  value: z.string().trim().min(1, 'Value is required'),
});
