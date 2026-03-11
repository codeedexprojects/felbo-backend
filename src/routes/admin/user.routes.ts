import { Router } from 'express';
import { userController } from '../../modules/user/user.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), userController.adminListUsers);
router.get('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), userController.adminGetUserDetail);
router.post('/:id/block', authorize('SUPER_ADMIN', 'SUB_ADMIN'), userController.adminBlockUser);
router.post('/:id/unblock', authorize('SUPER_ADMIN', 'SUB_ADMIN'), userController.adminUnblockUser);
router.get(
  '/:id/bookings',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  userController.adminGetUserBookings,
);

export default router;
