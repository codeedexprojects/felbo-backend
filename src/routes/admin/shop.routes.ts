import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/search', authorize('SUPER_ADMIN', 'SUB_ADMIN'), shopController.adminSearchShops);

export default router;
