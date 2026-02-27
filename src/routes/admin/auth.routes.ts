import { Router } from 'express';
import { adminController } from '../../modules/admin/admin.container';
import { authenticate } from '../../shared/middleware/authenticate';

const router = Router();

router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshToken);

router.post('/logout', authenticate, adminController.logout);

export default router;
