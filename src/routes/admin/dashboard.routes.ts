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

export default router;
