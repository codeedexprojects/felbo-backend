import { Router } from 'express';
import { vendorController } from '../../modules/vendor/vendor.container';

const router = Router();

router.get('/', vendorController.getVendorBookings);

export default router;
