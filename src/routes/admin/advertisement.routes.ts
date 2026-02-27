import { Router } from 'express';
import { advertisementController } from '../../modules/advertisement/advertisement.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.createAd);
router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.listAds);
router.get('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.getAd);
router.put('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.updateAd);
router.delete('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.deleteAd);

export default router;
