import { Router } from 'express';
import shopRoutes from './shop.routes';
import slotsRoutes from './slots.routes';

const router = Router();

router.use('/shops', shopRoutes);
router.use('/shops', slotsRoutes);

export default router;
