import { Router } from 'express';
import { barberController } from '../../modules/barber/barber.container';

const router = Router();

router.post('/', barberController.registerFcmToken);
router.delete('/', barberController.unregisterFcmToken);
router.post('/test', barberController.sendTestNotification);
router.post('/test-booking-flow', barberController.testBookingFlow);

export default router;
