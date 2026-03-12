import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { TwoFactorOtpService, DevOtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService } from '../../shared/services/jwt.service';
import UserRepository from './user.repository';
import UserService from './user.service';
import UserController from './user.controller';
import type { IssueService } from '../issue/issue.service';
import type { BookingService } from '../booking/booking.service';
import type { FavoriteService } from '../favorite/favorite.service';
import { issueService } from '../issue/issue.container';
import { bookingService } from '../booking/booking.container';
import { favoriteService } from '../favorite/favorite.container';

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
  (): IssueService => issueService,
  (): BookingService => bookingService,
  (): FavoriteService => favoriteService,
);

const userController = new UserController(userService);

export { userController, userService, userRepository };
