import { Router } from 'express';
import { barberController } from '../../modules/barber/barber.container';

const router = Router();

router.post('/send-otp', barberController.sendOtp);
router.post('/forgot-password', barberController.sendOtp);
router.post('/verify-otp', barberController.verifyOtp);
router.post('/set-password', barberController.setPassword);
router.post('/login', barberController.login);

export default router;
