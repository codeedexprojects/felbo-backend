import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router();

router.get('/', bookingController.getBarberBookings);
router.post('/:bookingId/cancel', bookingController.cancelBookingByBarber);
router.post('/:bookingId/complete', bookingController.completeBooking);

export default router;
