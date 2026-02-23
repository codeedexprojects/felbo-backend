import { Router } from 'express';
import { shopController } from './shop.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

// Onboarding routes
router.patch('/:shopId/profile', authenticate, authorize('VENDOR'), shopController.completeProfile);
router.post('/:shopId/services', authenticate, authorize('VENDOR'), shopController.addService);
router.post('/:shopId/barbers', authenticate, authorize('VENDOR'), shopController.addBarber);

// Vendor-facing (protected)
router.get('/my-shops', authenticate, authorize('VENDOR'), shopController.getMyShops);
router.get('/:shopId', authenticate, authorize('VENDOR'), shopController.getShop);
router.patch('/:shopId', authenticate, authorize('VENDOR'), shopController.updateShop);
router.patch(
  '/:shopId/working-hours',
  authenticate,
  authorize('VENDOR'),
  shopController.updateWorkingHours,
);

// Public discovery routes
router.get('/nearby', shopController.getNearbyShops);
router.get('/search', shopController.searchShops);
router.get('/:id', shopController.getShopById);

export const shopRoutes = router;
