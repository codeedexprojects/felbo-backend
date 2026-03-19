import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get(
  '/',
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  bookingController.adminGetBookings,
);

router.get(
  '/cancellations',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  bookingController.adminGetCancelledBookings,
);
router.get(
  '/cancellations/:bookingId',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  bookingController.adminGetCancelledBookingDetail,
);

router.get(
  '/:bookingId',
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  bookingController.adminGetBookingDetail,
);

export default router;
