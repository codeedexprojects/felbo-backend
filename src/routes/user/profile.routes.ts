// src/routes/user/profile.routes.ts

import { Router } from 'express';
import { userController } from '../../modules/user/user.container';

const router = Router();

router.get('/', userController.getProfile);
router.patch('/', userController.updateProfile);

export default router;
