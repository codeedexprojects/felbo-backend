import { Router } from 'express';
import { barberController } from './barber.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/shop/:shopId', authenticate, authorize('VENDOR'), barberController.listBarbers);

// Onboarding: add barber with service assignments (moved from POST /shops/:shopId/barbers)
router.post('/shop/:shopId', authenticate, authorize('VENDOR'), barberController.addBarber);

router.post('/', authenticate, authorize('VENDOR'), barberController.createBarber);

router.get('/:barberId', authenticate, authorize('VENDOR'), barberController.getBarber);
router.put('/:barberId', authenticate, authorize('VENDOR'), barberController.updateBarber);
router.delete('/:barberId', authenticate, authorize('VENDOR'), barberController.deleteBarber);
router.patch(
  '/:barberId/status',
  authenticate,
  authorize('VENDOR'),
  barberController.toggleBarberAvailability,
);
router.patch(
  '/:barberId/credentials',
  authenticate,
  authorize('VENDOR'),
  barberController.updateCredentials,
);

export const barberRoutes = router;
