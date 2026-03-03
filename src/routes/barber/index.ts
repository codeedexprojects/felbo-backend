import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import availabilityRoutes from './availability.routes';

const router = Router();

router.use(authenticate);
router.use(authorize('BARBER'));

router.use('/', availabilityRoutes);

export default router;
