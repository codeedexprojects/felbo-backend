// src/routes/admin/index.ts

import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';

import authRoutes from './auth.routes';
import vendorRoutes from './vendor.routes';
import userRoutes from './user.routes';
import issueRoutes from './issue.routes';
import advertisementRoutes from './advertisement.routes';

const router = Router();

// ==================== AUTH (mixed public/protected) ====================
router.use('/auth', authRoutes);

// ==================== PROTECTED ROUTES ====================
// authenticate is applied globally; each route file handles its own authorize()
// because admin roles differ per endpoint (SUPER_ADMIN vs SUB_ADMIN vs ASSOCIATION_ADMIN)
router.use(authenticate);

router.use('/vendors', vendorRoutes);
router.use('/users', userRoutes);
router.use('/issues', issueRoutes);
router.use('/advertisements', advertisementRoutes);

export default router;
