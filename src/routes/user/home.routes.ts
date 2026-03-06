import { Router } from 'express';
import { advertisementController } from '../../modules/advertisement/advertisement.container';
import { categoryController } from '../../modules/category/category.container';
import { shopController } from '../../modules/shop/shop.container';

const router = Router();

router.get('/advertisements', advertisementController.listUserAds);
router.get('/categories', categoryController.listUserCategories);
router.get('/shops/nearby', shopController.getNearbyShops);
router.get('/shops/search', shopController.searchShops);

export default router;
