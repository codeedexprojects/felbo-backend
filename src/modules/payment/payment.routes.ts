import { Router } from 'express';
import { paymentController } from './payment.container';

const router = Router();

router.post('/webhook/razorpay', paymentController.handleWebhook);

export const paymentRoutes = router;
