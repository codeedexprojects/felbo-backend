import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { JwtService } from '../../shared/services/jwt.service';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

import { vendorService } from '../vendor/vendor.container';

const adminRepository = new AdminRepository();

const jwtService = new JwtService(config.jwt.secret, config.jwt.adminExpirySeconds);

const adminService = new AdminService(adminRepository, jwtService, vendorService, logger);

const adminController = new AdminController(adminService);

export { adminController, adminService };
