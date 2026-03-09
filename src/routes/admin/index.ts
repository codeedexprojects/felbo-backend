import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';

import authRoutes from './auth.routes';
import vendorRoutes from './vendor.routes';
import userRoutes from './user.routes';
import issueRoutes from './issue.routes';
import advertisementRoutes from './advertisement.routes';
import categoryRoutes from './category.routes';
import shopRoutes from './shop.routes';
import configRoutes from './config.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use(authenticate);

router.use('/dashboard', dashboardRoutes);
router.use('/vendors', vendorRoutes);
router.use('/users', userRoutes);
router.use('/issues', issueRoutes);
router.use('/advertisements', advertisementRoutes);
router.use('/categories', categoryRoutes);
router.use('/shops', shopRoutes);
router.use('/config', configRoutes);

export default router;
