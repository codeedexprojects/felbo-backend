import { Router } from 'express';
import { advertisementController } from './advertisement.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'SUB_ADMIN'));

router.post('/', advertisementController.createAd);
router.get('/', advertisementController.listAds);
router.get('/:id', advertisementController.getAd);
router.put('/:id', advertisementController.updateAd);
router.delete('/:id', advertisementController.deleteAd);

export const advertisementRoutes = router;
