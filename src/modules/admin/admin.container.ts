import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { JwtService } from '../../shared/services/jwt.service';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

import { vendorService } from '../vendor/vendor.container';
import { issueService } from '../issue/issue.container';
import { bookingService } from '../booking/booking.container';
import { shopService } from '../shop/shop.container';
import { userService } from '../user/user.container';
import { financeService } from '../finance/finance.container';

const adminRepository = new AdminRepository();

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
  userService,
  issueService,
  logger,
  bookingService,
  shopService,
  financeService,
);

const adminController = new AdminController(adminService);

export { adminController, adminService };
