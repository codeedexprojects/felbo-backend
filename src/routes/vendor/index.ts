import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

import authRoutes from './auth.routes';
import uploadRoutes from './upload.routes';
import shopRoutes from './shop.routes';
import categoryRoutes from './category.routes';
import serviceRoutes from './service.routes';
import barberRoutes from './barber.routes';
import bookingsRoutes from './bookings.routes';
import dashboardRoutes from './dashboard.routes';
import fcmRoutes from './fcm.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/upload', uploadRoutes);

router.use(authenticate);
router.use(authorize('VENDOR'));

router.use('/shops', shopRoutes);
router.use('/categories', categoryRoutes);
router.use('/shops/:shopId/services', serviceRoutes);
router.use('/barbers', barberRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/fcm-token', fcmRoutes);

export default router;
