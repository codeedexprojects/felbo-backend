import { Router } from 'express';
import { shopController } from './shop.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

// Vendor-facing (protected)
router.get('/my-shop', authenticate, authorize('VENDOR'), shopController.getMyShop);
router.patch('/my-shop', authenticate, authorize('VENDOR'), shopController.updateMyShop);
router.patch(
  '/my-shop/working-hours',
  authenticate,
  authorize('VENDOR'),
  shopController.updateWorkingHours,
);

// Public discovery routes
router.get('/nearby', shopController.getNearbyShops);
router.get('/search', shopController.searchShops);
router.get('/:id', shopController.getShopById);

export const shopRoutes = router;
