import { Router } from 'express';
import { vendorController } from '../../modules/vendor/vendor.container';

const router = Router();

router.get('/stats', vendorController.getDashboardStats);

export default router;
