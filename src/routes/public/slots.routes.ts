import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router({ mergeParams: true });

// GET /api/v1/public/shops/:shopId/slots?date=YYYY-MM-DD&serviceIds=id1,id2&barberId=xxx
router.get('/:shopId/slots', bookingController.getSlots);

export default router;
