import { Router } from 'express';
import { adminController } from './admin.container';

import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshToken);

router.use(authenticate);

router.post('/logout', adminController.logout);

router.get(
  '/vendors',
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  adminController.listVendors,
);

router.get(
  '/vendors/requests',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.listVerificationRequests,
);

router.get(
  '/vendors/requests/:id',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.getVendorRequestDetail,
);

router.get(
  '/vendors/:id',
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  adminController.getVendorDetail,
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

router.get('/users', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.listUsers);
router.get('/users/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.getUserDetail);
router.post('/users/:id/block', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.blockUser);
router.post(
  '/users/:id/unblock',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.unblockUser,
);

export const adminRoutes = router;
