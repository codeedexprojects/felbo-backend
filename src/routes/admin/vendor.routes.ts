import { Router } from 'express';
import { adminController } from '../../modules/admin/admin.container';
import { bookingController } from '../../modules/booking/booking.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get(
  '/requests',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.listVerificationRequests,
);
router.get(
  '/requests/:id',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  adminController.getVendorRequestDetail,
);

router.get(
  '/',
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  adminController.listVendors,
);
router.get(
  '/:id',
  authorize('SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'),
  adminController.getVendorDetail,
);
router.post('/:id/verify', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.verifyVendor);
router.post('/:id/reject', authorize('SUPER_ADMIN', 'SUB_ADMIN'), adminController.rejectVendor);

router.get(
  '/:id/bookings',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  bookingController.adminGetVendorBookings,
);

export default router;
