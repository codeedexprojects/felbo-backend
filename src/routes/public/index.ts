import { Router } from 'express';
import slotsRoutes from './slots.routes';

const router = Router();

router.use('/shops', slotsRoutes);

export default router;
