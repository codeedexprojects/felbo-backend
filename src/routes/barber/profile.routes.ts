import { Router } from 'express';
import { barberController } from '../../modules/barber/barber.container';

const router = Router();

router.get('/profile', barberController.getProfile);

export default router;
