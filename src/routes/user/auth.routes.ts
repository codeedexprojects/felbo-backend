// src/routes/user/auth.routes.ts

import { Router } from 'express';
import { userController } from '../../modules/user/user.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

// Public
router.post('/send-otp', userController.sendOtp);
router.post('/verify-otp', userController.verifyOtp);
router.post('/refresh-token', userController.refreshToken);

// Protected
router.post('/logout', authenticate, authorize('USER'), userController.logout);

export default router;
