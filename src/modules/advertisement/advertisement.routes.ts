import { Router } from 'express';
import { advertisementController } from './advertisement.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  advertisementController.createAd,
);
router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  advertisementController.listAds,
);
router.get(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  advertisementController.getAd,
);
router.put(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  advertisementController.updateAd,
);
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  advertisementController.deleteAd,
);

export const advertisementRoutes = router;
