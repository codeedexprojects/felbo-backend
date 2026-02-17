import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { TwoFactorOtpService, DevOtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService } from '../../shared/services/jwt.service';
import VendorRepository from './vendor.repository';
import VendorService from './vendor.service';
import VendorController from './vendor.controller';

const vendorRepository = new VendorRepository();

const otpService = config.isProduction
  ? new TwoFactorOtpService(logger, config.otp.twoFactorApiKey)
  : new DevOtpService(logger, config.otp.devFixedOtp);

const otpSessionService = new OtpSessionService();

const jwtService = new JwtService(config.jwt.secret, config.jwt.expirySeconds);

const vendorService = new VendorService(
  vendorRepository,
  otpService,
  otpSessionService,
  jwtService,
  logger,
);

const vendorController = new VendorController(vendorService);

export { vendorController, vendorService };
