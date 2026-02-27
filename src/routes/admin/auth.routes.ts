// src/routes/admin/auth.routes.ts

import { Router } from 'express';
import { adminController } from '../../modules/admin/admin.container';
import { authenticate } from '../../shared/middleware/authenticate';

const router = Router();

// Public
router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshToken);

// Protected (authenticate only — no role check, matches existing behaviour)
router.post('/logout', authenticate, adminController.logout);

export default router;
