import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

import authRoutes from './auth.routes';
import uploadRoutes from './upload.routes';
import shopRoutes from './shop.routes';
import categoryRoutes from './category.routes';
import serviceRoutes from './service.routes';
import barberRoutes from './barber.routes';

const router = Router();

router.use('/auth', authRoutes);
// Upload routes are accessible without JWT — vendors upload during registration
router.use('/upload', uploadRoutes);

router.use(authenticate);
router.use(authorize('VENDOR'));

router.use('/shops', shopRoutes);
router.use('/shops/:shopId/categories', categoryRoutes);
router.use('/shops/:shopId/services', serviceRoutes);
router.use('/barbers', barberRoutes);

export default router;
