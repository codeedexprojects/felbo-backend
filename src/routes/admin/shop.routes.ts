import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/search', authorize('SUPER_ADMIN', 'SUB_ADMIN'), shopController.adminSearchShops);
router.get('/pending', authorize('SUPER_ADMIN', 'SUB_ADMIN'), shopController.listPendingShops);
router.post('/:shopId/approve', authorize('SUPER_ADMIN', 'SUB_ADMIN'), shopController.approveShop);
router.post('/:shopId/reject', authorize('SUPER_ADMIN', 'SUB_ADMIN'), shopController.rejectShop);

export default router;
