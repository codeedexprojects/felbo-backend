import { Router } from 'express';
import { userController } from './user.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

// Public routes
router.post('/send-otp', userController.sendOtp);
router.post('/verify-otp', userController.verifyOtp);

// Protected routes
router.get('/profile', authenticate, authorize('USER'), userController.getProfile);
router.patch('/profile', authenticate, authorize('USER'), userController.updateProfile);

export const userRoutes = router;
