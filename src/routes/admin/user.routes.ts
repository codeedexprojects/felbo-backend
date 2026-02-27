// src/routes/admin/user.routes.ts

import { Router } from 'express';
import { adminController } from '../../modules/admin/admin.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.listUsers);
router.get('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.getUserDetail);
router.post('/:id/block', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.blockUser);
router.post('/:id/unblock', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.unblockUser);

export default router;
