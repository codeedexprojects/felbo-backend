import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { JwtService } from '../../shared/services/jwt.service';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

import { vendorService } from '../vendor/vendor.container';
import { issueService } from '../issue/issue.container';
import UserRepository from '../user/user.repository';
import { IssueRepository } from '../issue/issue.repository';
import { BookingRepository } from '../booking/booking.repository';
import ShopRepository from '../shop/shop.repository';

const adminRepository = new AdminRepository();
const userRepository = new UserRepository();
const issueRepository = new IssueRepository();
const bookingRepository = new BookingRepository();
const shopRepository = new ShopRepository();

const jwtService = new JwtService(
  config.jwt.secret,
  config.jwt.adminExpirySeconds,
  config.jwt.refreshSecret,
  config.jwt.adminRefreshExpiry,
);

const adminService = new AdminService(
  adminRepository,
  jwtService,
  vendorService,
  userRepository,
  issueService,
  logger,
  issueRepository,
  bookingRepository,
  shopRepository,
);

const adminController = new AdminController(adminService);

export { adminController, adminService };
