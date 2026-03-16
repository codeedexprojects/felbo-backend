import { Router } from 'express';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router();

router.get('/dashboard', bookingController.getBarberDashboard);
router.get('/today', bookingController.getBarberTodayConfirmed);

export default router;
