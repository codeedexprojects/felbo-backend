import { Router } from 'express';
import { vendorController } from '../../modules/vendor/vendor.container';

const router = Router();

router.get('/kerala-districts', vendorController.getKeralaDistricts);

export default router;
