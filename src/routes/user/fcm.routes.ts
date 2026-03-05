import { Router } from 'express';
import { userController } from '../../modules/user/user.container';

const router = Router();

router.post('/', userController.registerFcmToken);
router.delete('/', userController.unregisterFcmToken);

export default router;
