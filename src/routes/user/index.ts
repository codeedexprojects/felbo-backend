// src/routes/user/index.ts

import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';

const router = Router();

// ==================== AUTH (mixed public/protected) ====================
router.use('/auth', authRoutes);

// ==================== PROTECTED ROUTES ====================
router.use(authenticate);
router.use(authorize('USER'));

router.use('/profile', profileRoutes);

export default router;
