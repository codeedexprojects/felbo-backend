import { Router } from 'express';
import vendorRoutes from './vendor';
import userRoutes from './user';
import adminRoutes from './admin';
import publicRoutes from './public';
import webhookRoutes from './webhook';

const router = Router();

router.use('/public', publicRoutes);

router.use('/user', userRoutes);
router.use('/vendor', vendorRoutes);
router.use('/admin', adminRoutes);

router.use('/webhooks', webhookRoutes);

export default router;
