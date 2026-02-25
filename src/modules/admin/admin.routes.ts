import { Router } from 'express';
import { adminController } from './admin.container';

import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshToken);

router.post('/logout', authenticate, adminController.logout);

router.get(
  '/vendors',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  adminController.listVendors,
);

router.get(
  '/vendors/requests',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.listVerificationRequests,
);

router.get(
  '/vendors/requests/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.getVendorRequestDetail,
);

router.get(
  '/vendors/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  adminController.getVendorDetail,
);

router.post(
  '/vendors/:id/verify',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.verifyVendor,
);

router.post(
  '/vendors/:id/reject',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.rejectVendor,
);

router.get(
  '/users',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.listUsers,
);
router.get(
  '/users/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.getUserDetail,
);
router.post(
  '/users/:id/block',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.blockUser,
);
router.post(
  '/users/:id/unblock',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.unblockUser,
);

export const adminRoutes = router;
