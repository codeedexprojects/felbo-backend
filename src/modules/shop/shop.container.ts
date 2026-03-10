import { logger } from '../../shared/logger/logger';
import ShopRepository from './shop.repository';
import ShopService from './shop.service';
import ShopController from './shop.controller';
import { barberService } from '../barber/barber.container';
import { BarberService } from '../barber/barber.service';
import { serviceService } from '../service/service.container';
import { ServiceService } from '../service/service.service';
import { userService } from '../user/user.container';
import UserService from '../user/user.service';
import { configService } from '../config/config.container';
import { favoriteService } from '../favorite/favorite.container';
import { FavoriteService } from '../favorite/favorite.service';

const shopRepository = new ShopRepository();

const shopService: ShopService = new ShopService(
  shopRepository,
  logger,
  (): BarberService => barberService,
  (): ServiceService => serviceService,
  (): UserService => userService,
  configService,
  (): FavoriteService => favoriteService,
);

const shopController = new ShopController(shopService);

export { shopService, shopController };
