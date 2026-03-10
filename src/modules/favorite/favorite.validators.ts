import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const addFavoriteSchema = z.object({
  shopId: mongoIdSchema,
});

export const favoriteShopIdParamSchema = z.object({
  shopId: mongoIdSchema,
});

export const listFavoritesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
