import { ServiceRepository } from './service.repository';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { logger } from '../../shared/logger/logger';
import { shopService } from '../shop/shop.container';
import { barberService } from '../barber/barber.container';

const serviceRepository = new ServiceRepository();
const serviceService = new ServiceService(
  serviceRepository,
  () => shopService,
  () => barberService,
  logger,
);
const serviceController = new ServiceController(serviceService);

export { serviceController, serviceService };
