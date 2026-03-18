import { Router } from 'express';
import { vendorController } from '../../modules/vendor/vendor.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post('/send-otp', vendorController.sendOtp);
router.post('/login/verify-otp', vendorController.loginVerifyOtp);
router.post('/register/verify-otp', vendorController.registerVerifyOtp);
router.post('/register/association', vendorController.registerAssociation);
router.get('/register/independent/payment-summary', vendorController.getRegistrationPaymentSummary);
router.post('/register/independent/initiate', vendorController.registerIndependentInitiate);
router.post('/register/independent/confirm', vendorController.registerIndependentConfirm);

router.get('/profile', authenticate, authorize('VENDOR'), vendorController.getProfile);
router.patch('/profile', authenticate, authorize('VENDOR'), vendorController.updateProfile);
router.get(
  '/registration-status',
  authenticate,
  authorize('VENDOR'),
  vendorController.getRegistrationStatus,
);

router.get(
  '/onboarding-status',
  authenticate,
  authorize('VENDOR'),
  vendorController.getOnboardingStatus,
);

router.post('/refresh-token', vendorController.refreshToken);
router.post('/logout', authenticate, authorize('VENDOR'), vendorController.logout);

export default router;
