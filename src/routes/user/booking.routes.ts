import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router();

router.post('/', bookingController.initiateBooking);

router.post('/:bookingId/confirm', bookingController.confirmBooking);

export default router;
