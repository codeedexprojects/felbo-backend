import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';

import authRoutes from './auth.routes';
import vendorRoutes from './vendor.routes';
import userRoutes from './user.routes';
import issueRoutes from './issue.routes';
import advertisementRoutes from './advertisement.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use(authenticate);

router.use('/vendors', vendorRoutes);
router.use('/users', userRoutes);
router.use('/issues', issueRoutes);
router.use('/advertisements', advertisementRoutes);

export default router;
