import { logger } from '../../shared/logger/logger';
import ShopRepository from './shop.repository';
import ShopService from './shop.service';
import ShopController from './shop.controller';
import { barberService } from '../barber/barber.container';
import { BarberService } from '../barber/barber.service';

const shopRepository = new ShopRepository();

const shopService: ShopService = new ShopService(
  shopRepository,
  logger,
  (): BarberService => barberService,
);

const shopController = new ShopController(shopService);

export { shopService, shopController };
