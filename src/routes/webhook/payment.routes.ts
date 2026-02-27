// src/routes/webhook/payment.routes.ts

import { Router } from 'express';
import { paymentController } from '../../modules/payment/payment.container';

const router = Router();

router.post('/razorpay', paymentController.handleWebhook);

export default router;
