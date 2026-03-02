import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  displayOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1, 'Category name is required').max(100).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field is required for update.',
  });

export const categoryIdParamSchema = z.object({
  categoryId: mongoIdSchema,
});
