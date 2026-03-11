import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';

const router = Router();

router.get('/:id/details', shopController.getShopDetails);
router.get('/:id/services', shopController.getShopServices);

export default router;
