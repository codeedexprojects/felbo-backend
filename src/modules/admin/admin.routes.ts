import { Router } from 'express';
import { adminController } from './admin.container';

import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshToken);

router.use(authenticate);

router.post('/logout', adminController.logout);

router.get('/vendors', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.listVendors);

router.get(
  '/vendors/requests',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.listVerificationRequests,
);

router.post(
  '/vendors/:id/verify',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.verifyVendor,
);

router.post(
  '/vendors/:id/reject',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.rejectVendor,
);

export const adminRoutes = router;
