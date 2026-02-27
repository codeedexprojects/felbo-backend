import { Router } from 'express';
import shopRoutes from './shop.routes';

const router = Router();

router.use('/shops', shopRoutes);

export default router;
