import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import PaymentRepository from './payment.repository';
import PaymentService from './payment.service';
import PaymentController from './payment.controller';

const paymentRepository = new PaymentRepository();

const paymentService = new PaymentService(
  paymentRepository,
  config.razorpay.keyId,
  config.razorpay.keySecret,
  config.razorpay.webhookSecret,
  logger,
);

const paymentController = new PaymentController(paymentService);

export { paymentService, paymentController };
