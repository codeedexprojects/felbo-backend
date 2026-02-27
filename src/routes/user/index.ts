import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';
import issueRoutes from './issue.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use(authenticate);
router.use(authorize('USER'));

router.use('/profile', profileRoutes);
router.use('/issues', issueRoutes);

export default router;
