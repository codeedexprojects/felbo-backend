import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import authRoutes from './auth.routes';
import availabilityRoutes from './availability.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use(authenticate);
router.use(authorize('BARBER'));

router.use('/', availabilityRoutes);

export default router;
