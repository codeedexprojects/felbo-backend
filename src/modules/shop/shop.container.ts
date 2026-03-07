import { logger } from '../../shared/logger/logger';
import ShopRepository from './shop.repository';
import ShopService from './shop.service';
import ShopController from './shop.controller';
import { barberService } from '../barber/barber.container';
import { BarberService } from '../barber/barber.service';
import { serviceService } from '../service/service.container';
import { ServiceService } from '../service/service.service';
import { userRepository } from '../user/user.container';
import UserRepository from '../user/user.repository';

const shopRepository = new ShopRepository();

const shopService: ShopService = new ShopService(
  shopRepository,
  logger,
  (): BarberService => barberService,
  (): ServiceService => serviceService,
  (): UserRepository => userRepository,
);

const shopController = new ShopController(shopService);

export { shopService, shopController };
