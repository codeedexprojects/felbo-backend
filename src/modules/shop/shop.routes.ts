import { Router } from 'express';
import { shopController } from './shop.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

// Public discovery routes — must be registered before vendor /:shopId to avoid shadowing
router.get('/nearby', shopController.getNearbyShops);
router.get('/search', shopController.searchShops);

// Public shop details page (services + barbers + distance)
router.get('/:id/details', shopController.getShopDetails);

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

// Onboarding routes
router.patch('/:shopId/profile', authenticate, authorize('VENDOR'), shopController.completeProfile);
router.post('/:shopId/categories', authenticate, authorize('VENDOR'), shopController.addCategory);
router.post('/:shopId/services', authenticate, authorize('VENDOR'), shopController.addService);
router.post('/:shopId/barbers', authenticate, authorize('VENDOR'), shopController.addBarber);

export const shopRoutes = router;
