import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  image: z.string().min(1, 'Image URL/path is required'),
  displayOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1, 'Category name is required').max(100).optional(),
    image: z.string().min(1, 'Image URL/path is required').optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field is required for update.',
  });

export const categoryIdParamSchema = z.object({
  categoryId: mongoIdSchema,
});

export const listCategoriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
