import { Router } from 'express';
import { authController } from './auth.container';

const router = Router();

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

export const authRoutes = router;
