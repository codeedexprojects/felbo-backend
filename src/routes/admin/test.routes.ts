import { Router } from 'express';
import { testController } from '../../modules/admin/test.controller';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

// Test route for booking confirmation (enqueues both user and barber notifications)
router.post(
  '/booking-confirmed',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  testController.testBookingConfirmed,
);

export default router;
