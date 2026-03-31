import { Router } from 'express';
import { adminController } from '../../modules/admin/admin.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.getSuperAdminDashboard);

router.get(
  '/association',
  authorize('ASSOCIATION_ADMIN'),
  adminController.getAssociationAdminDashboard,
);

router.get(
  '/association/top-vendors',
  authorize('ASSOCIATION_ADMIN'),
  adminController.getTopAssociationVendors,
);

export default router;
