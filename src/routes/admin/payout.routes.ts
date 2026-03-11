import { Router } from 'express';
import { payoutController } from '../../modules/payout/payout.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/dashboard', authorize('SUPER_ADMIN'), payoutController.getDashboard);
router.post('/', authorize('SUPER_ADMIN'), payoutController.createPayout);
router.get('/', authorize('SUPER_ADMIN', 'ASSOCIATION_ADMIN'), payoutController.listPayouts);
router.get('/summary', authorize('ASSOCIATION_ADMIN'), payoutController.getAssocSummary);
router.put('/:id/accept', authorize('ASSOCIATION_ADMIN'), payoutController.acceptPayout);
router.put('/:id/reject', authorize('ASSOCIATION_ADMIN'), payoutController.rejectPayout);

export default router;
