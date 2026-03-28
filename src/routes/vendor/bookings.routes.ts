import { Router } from 'express';
import { vendorController } from '../../modules/vendor/vendor.container';

const router = Router();

router.get('/', vendorController.getVendorBookings);
router.get('/:bookingId', vendorController.getVendorBookingDetail);

export default router;
