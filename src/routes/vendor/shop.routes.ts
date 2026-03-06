import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';
import { uploadController } from '../../modules/upload/upload.container';

const router = Router();

// Shop photo uploads → vendors/{vendorId}/shops/{uuid}.ext
router.post('/upload/url', uploadController.generateUploadUrl('vendors/', true, 'shops'));
router.post('/upload/verify', uploadController.verifyUpload('vendors/', true, 'shops'));

router.post('/', shopController.createShop);
router.get('/my-shops', shopController.getMyShops);
router.get('/:shopId', shopController.getShop);
router.patch('/:shopId', shopController.updateShop);
router.patch('/:shopId/working-hours', shopController.updateWorkingHours);
router.patch('/:shopId/profile', shopController.completeProfile);
router.delete('/:shopId', shopController.deleteShop);
router.patch('/:shopId/available', shopController.toggleShopAvailable);

export default router;
