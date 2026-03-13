import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router({ mergeParams: true });

router.get('/:shopId/barbers', bookingController.getBarbersForServices);
router.get('/:shopId/slots', bookingController.getSlots);

export default router;
