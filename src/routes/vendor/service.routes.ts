import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';

const router = Router({ mergeParams: true });

router.get('/', shopController.listServices);
router.post('/', shopController.createService);
router.post('/onboarding', shopController.addService);
router.put('/:serviceId', shopController.updateService);
router.delete('/:serviceId', shopController.deleteService);
router.patch('/:serviceId/toggle', shopController.toggleService);

export default router;
