import { Request, Response } from 'express';
import { FavoriteService } from './favorite.service';
import {
  addFavoriteSchema,
  favoriteShopIdParamSchema,
  listFavoritesSchema,
} from './favorite.validators';

export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  add = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = addFavoriteSchema.parse(req.body);
    const result = await this.favoriteService.addFavorite(req.user!.sub, shopId);
    res.status(201).json({ success: true, data: result });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = favoriteShopIdParamSchema.parse(req.params);
    await this.favoriteService.removeFavorite(req.user!.sub, shopId);
    res.status(200).json({ success: true, message: 'Removed from favorites.' });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = listFavoritesSchema.parse(req.query);
    const result = await this.favoriteService.listFavorites(req.user!.sub, page, limit);
    res.status(200).json({ success: true, data: result });
  };
}
