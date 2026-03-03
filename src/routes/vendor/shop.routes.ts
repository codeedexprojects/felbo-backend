import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';

const router = Router();

router.post('/', shopController.createShop);
router.get('/my-shops', shopController.getMyShops);
router.get('/:shopId', shopController.getShop);
router.patch('/:shopId', shopController.updateShop);
router.patch('/:shopId/working-hours', shopController.updateWorkingHours);
router.patch('/:shopId/profile', shopController.completeProfile);
router.delete('/:shopId', shopController.deleteShop);
router.patch('/:shopId/available', shopController.toggleShopAvailable);

export default router;
