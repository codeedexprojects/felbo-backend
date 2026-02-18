import { Router } from 'express';
import { adminController } from './admin.container';

const router = Router();

router.post('/login', adminController.login);

export const adminRoutes = router;
