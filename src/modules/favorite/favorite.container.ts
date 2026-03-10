import { FavoriteRepository } from './favorite.repository';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';
import { shopService } from '../shop/shop.container';
import ShopService from '../shop/shop.service';

const favoriteRepository = new FavoriteRepository();

const favoriteService = new FavoriteService(favoriteRepository, (): ShopService => shopService);

const favoriteController = new FavoriteController(favoriteService);

export { favoriteRepository, favoriteService, favoriteController };
