import { Router } from 'express';
import { barberController } from '../../modules/barber/barber.container';

const router = Router();

router.get('/shop/:shopId', barberController.listBarbers);
router.post('/shop/:shopId', barberController.addBarber);
router.post('/', barberController.createBarber);
router.get('/:barberId', barberController.getBarber);
router.put('/:barberId', barberController.updateBarber);
router.delete('/:barberId', barberController.deleteBarber);
router.patch('/:barberId/status', barberController.toggleBarberAvailability);
router.patch('/:barberId/credentials', barberController.updateCredentials);

export default router;
