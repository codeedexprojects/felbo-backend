import { BarberRepository } from './barber.repository';
import { BarberService } from './barber.service';
import { BarberController } from './barber.controller';
import { shopService } from '../shop/shop.container';
import { logger } from '../../shared/logger/logger';
import { config } from '../../shared/config/config.service';
import {
  BrevoEmailOtpService,
  DevBrevoEmailOtpService,
} from '../../shared/services/brevo-email-otp.service';
import { JwtService } from '../../shared/services/jwt.service';
import { configService } from '../config/config.container';

const barberRepository = new BarberRepository();

const emailOtpService = config.isProduction
  ? new BrevoEmailOtpService(
      logger,
      config.brevo.apiKey,
      config.brevo.fromEmail,
      config.brevo.fromName,
    )
  : new DevBrevoEmailOtpService(logger, config.otp.devFixedOtp);

const jwtService = new JwtService(config.jwt.secret, config.jwt.expirySeconds);

const barberService: BarberService = new BarberService(
  barberRepository,
  () => shopService,
  logger,
  emailOtpService,
  jwtService,
  configService,
);

const barberController = new BarberController(barberService);

export { barberController, barberService };
