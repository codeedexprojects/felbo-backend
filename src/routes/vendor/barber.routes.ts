import { Router } from 'express';
import { barberController } from '../../modules/barber/barber.container';
import { serviceController } from '../../modules/service/service.container';

const router = Router();

router.get('/shop/:shopId', barberController.listBarbers);
router.post('/shop/:shopId', barberController.addBarber);

router.post('/', barberController.createBarber);
router.get('/:barberId', barberController.getBarber);
router.put('/:barberId', barberController.updateBarber);
router.delete('/:barberId', barberController.deleteBarber);
router.patch('/:barberId/status', barberController.toggleBarberAvailability);
router.patch('/:barberId/credentials', barberController.updateCredentials);

router.get('/:barberId/services', serviceController.getBarberServices);
router.put('/:barberId/services', serviceController.assignServices);
router.delete('/:barberId/services/:serviceId', serviceController.removeBarberService);

export default router;
