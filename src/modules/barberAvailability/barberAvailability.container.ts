import { BarberAvailabilityRepository } from './barberAvailability.repository';
import { BarberAvailabilityService } from './barberAvailability.service';
import { BarberAvailabilityController } from './barberAvailability.controller';
import { barberService } from '../barber/barber.container';
import { shopService } from '../shop/shop.container';
import { logger } from '../../shared/logger/logger';

const availabilityRepository = new BarberAvailabilityRepository();
const availabilityService = new BarberAvailabilityService(
  availabilityRepository,
  () => barberService,
  () => shopService,
  logger,
);
const availabilityController = new BarberAvailabilityController(availabilityService);

barberService.setAvailabilityService(availabilityService);

export { availabilityController, availabilityService };
