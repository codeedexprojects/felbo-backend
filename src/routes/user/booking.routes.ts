import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router();

router.get('/', bookingController.getUserBookingsList);
router.get('/:bookingId', bookingController.getUserBookingDetail);

router.post('/', bookingController.initiateBooking);
router.post('/:bookingId/confirm', bookingController.confirmBooking);
router.post('/:bookingId/cancel', bookingController.cancelBookingByUser);

export default router;
