import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/', authorize('SUPER_ADMIN', 'ASSOCIATION_ADMIN'), bookingController.adminGetBookings);
router.get(
  '/:bookingId',
  authorize('SUPER_ADMIN', 'ASSOCIATION_ADMIN'),
  bookingController.adminGetBookingDetail,
);

export default router;
