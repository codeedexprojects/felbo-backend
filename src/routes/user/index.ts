import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';
import issueRoutes from './issue.routes';
import fcmRoutes from './fcm.routes';
import homeRoutes from './home.routes';
import shopRoutes from './shop.routes';
import bookingRoutes from './booking.routes';
import favoritesRoutes from './favorites.routes';
import reviewRoutes from './review.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use(authenticate);
router.use(authorize('USER'));

router.use('/profile', profileRoutes);
router.use('/issues', issueRoutes);
router.use('/fcm-token', fcmRoutes);
router.use('/home', homeRoutes);
router.use('/shops', shopRoutes);
router.use('/favorites', favoritesRoutes);
router.use('/bookings', bookingRoutes);
router.use('/reviews', reviewRoutes);

export default router;
