import { logger } from '../../shared/logger/logger';
import ShopRepository from './shop.repository';
import ShopService from './shop.service';
import ShopController from './shop.controller';

const shopRepository = new ShopRepository();

const shopService = new ShopService(shopRepository, logger);

const shopController = new ShopController(shopService);

export { shopService, shopController };
