import { BarberRepository } from './barber.repository';
import { BarberService } from './barber.service';
import { BarberController } from './barber.controller';
import { shopService } from '../shop/shop.container';
import { logger } from '../../shared/logger/logger';

const barberRepository = new BarberRepository();
const barberService: BarberService = new BarberService(barberRepository, shopService, logger);
const barberController = new BarberController(barberService);

export { barberController, barberService };
