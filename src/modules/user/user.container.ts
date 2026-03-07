import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { TwoFactorOtpService, DevOtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService } from '../../shared/services/jwt.service';
import UserRepository from './user.repository';
import UserService from './user.service';
import UserController from './user.controller';

const userRepository = new UserRepository();

const otpService = config.isProduction
  ? new TwoFactorOtpService(logger, config.otp.twoFactorApiKey)
  : new DevOtpService(logger, config.otp.devFixedOtp);

const otpSessionService = new OtpSessionService();

const jwtService = new JwtService(
  config.jwt.secret,
  config.jwt.expirySeconds,
  config.jwt.refreshSecret,
  config.jwt.refreshExpiry,
);

const userService = new UserService(
  userRepository,
  otpService,
  otpSessionService,
  jwtService,
  logger,
);

const userController = new UserController(userService);

export { userController, userService, userRepository };
