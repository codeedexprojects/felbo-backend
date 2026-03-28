import { Router } from 'express';
import { advertisementController } from '../../modules/advertisement/advertisement.container';
import { categoryController } from '../../modules/category/category.container';
import { shopController } from '../../modules/shop/shop.container';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router();

router.get('/advertisements', advertisementController.listUserAds);
router.get('/categories', categoryController.listUserCategories);
router.get('/shops/nearby', shopController.getNearbyShops);
router.get('/shops/recommended', shopController.getRecommendedShops);
router.get('/shops/search', shopController.searchShops);
router.get('/booking-summary', bookingController.getUserHomeBookingData);

export default router;
