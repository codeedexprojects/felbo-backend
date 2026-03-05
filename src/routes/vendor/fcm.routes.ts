import { Router } from 'express';
import { vendorController } from '../../modules/vendor/vendor.container';

const router = Router();

router.post('/', vendorController.registerFcmToken);
router.delete('/', vendorController.unregisterFcmToken);

export default router;
