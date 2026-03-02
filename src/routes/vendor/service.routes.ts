import { Router } from 'express';
import { serviceController } from '../../modules/service/service.container';

const router = Router({ mergeParams: true });

router.get('/', serviceController.listServices);
router.post('/', serviceController.createService);
router.post('/onboarding', serviceController.addService);
router.put('/:serviceId', serviceController.updateService);
router.delete('/:serviceId', serviceController.deleteService);
router.patch('/:serviceId/toggle', serviceController.toggleService);

export default router;
