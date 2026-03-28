import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import PaymentRepository from './payment.repository';
import PaymentService from './payment.service';
import PaymentController from './payment.controller';
import { issueService } from '../issue/issue.container';

const paymentRepository = new PaymentRepository();

const paymentService: PaymentService = new PaymentService(
  paymentRepository,
  () => issueService,
  config.razorpay.keyId,
  config.razorpay.keySecret,
  config.razorpay.webhookSecret,
  logger,
);

const paymentController = new PaymentController(paymentService);

export { paymentService, paymentController };
