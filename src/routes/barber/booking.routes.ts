import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router();

router.get('/', bookingController.getBarberBookings);
router.get('/:bookingId', bookingController.getBarberBookingDetail);
router.post('/:bookingId/cancel', bookingController.cancelBookingByBarber);
router.post('/:bookingId/complete', bookingController.completeBooking);
router.post('/:bookingId/no-show', bookingController.markNoShow);

export default router;
