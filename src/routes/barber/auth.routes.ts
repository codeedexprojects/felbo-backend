import { Router } from 'express';
import { barberController } from '../../modules/barber/barber.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post('/send-otp', barberController.sendOtp);
router.post('/forgot-password', barberController.sendOtp);
router.post('/verify-otp', barberController.verifyOtp);
router.post('/set-password', barberController.setPassword);
router.post('/login', barberController.login);
router.post('/refresh-token', barberController.refreshToken);

router.post('/logout', authenticate, authorize('BARBER'), barberController.logout);

export default router;
