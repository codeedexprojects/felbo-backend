import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { TwoFactorOtpService, DevOtpService, OtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService } from '../../shared/services/jwt.service';
import { userService } from '../user/user.container';
import AuthService from './auth.service';
import AuthController from './auth.controller';

interface AuthContainer {
  authController: AuthController;
  authService: AuthService;
  jwtService: JwtService;
}

const createAuthContainer = (): AuthContainer => {
  const otpService: OtpService = config.isProduction
    ? new TwoFactorOtpService(logger, config.otp.twoFactorApiKey)
    : new DevOtpService(logger, config.otp.devFixedOtp);

  const otpSessionService = new OtpSessionService();
  const jwtService = new JwtService(config.jwt.secret, config.jwt.expirySeconds);
  const authService = new AuthService(
    userService,
    otpService,
    otpSessionService,
    jwtService,
    logger,
  );
  const authController = new AuthController(authService);

  return { authController, authService, jwtService };
};

export const { authController, authService, jwtService } = createAuthContainer();
