import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { barberService } from '../barber/barber.container';
import { availabilityService } from '../barberAvailability/barberAvailability.container';
import { shopService } from '../shop/shop.container';
import { configService } from '../config/config.container';
import { userService } from '../user/user.container';
import { serviceService } from '../service/service.container';
import { paymentService } from '../payment/payment.container';
import { vendorService } from '../vendor/vendor.container';
import { felboCoinService } from '../felbocoin/felbocoin.container';
import { issueService } from '../issue/issue.container';
import type { IssueService } from '../issue/issue.service';

import { logger } from '../../shared/logger/logger';

const bookingRepository = new BookingRepository();

const bookingService: BookingService = new BookingService(
  bookingRepository,
  () => barberService,
  () => availabilityService,
  () => shopService,
  configService,
  () => userService,
  () => serviceService,
  () => paymentService,
  () => vendorService,
  logger,
  () => felboCoinService,
  (): IssueService => issueService,
);

const bookingController = new BookingController(bookingService);

barberService.setBookingService(bookingService);

export { bookingController, bookingService };
