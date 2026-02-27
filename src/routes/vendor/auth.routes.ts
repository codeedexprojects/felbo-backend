// src/routes/vendor/auth.routes.ts

import { Router } from 'express';
import { vendorController } from '../../modules/vendor/vendor.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

// Public
router.post('/send-otp', vendorController.sendOtp);
router.post('/login/verify-otp', vendorController.loginVerifyOtp);
router.post('/register/verify-otp', vendorController.registerVerifyOtp);
router.post('/register/association', vendorController.registerAssociation);
router.post('/register/independent/initiate', vendorController.registerIndependentInitiate);
router.post('/register/independent/confirm', vendorController.registerIndependentConfirm);

// Protected
router.get('/profile', authenticate, authorize('VENDOR'), vendorController.getProfile);
router.get(
  '/registration-status',
  authenticate,
  authorize('VENDOR'),
  vendorController.getRegistrationStatus,
);

export default router;
