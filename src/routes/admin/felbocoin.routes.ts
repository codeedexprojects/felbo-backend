import { Router } from 'express';
import { felboCoinController } from '../../modules/felbocoin/felbocoin.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/stats', authorize('SUPER_ADMIN', 'SUB_ADMIN'), felboCoinController.getAdminCoinStats);
router.get(
  '/transactions',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  felboCoinController.getAllTransactions,
);
router.get('/trend', authorize('SUPER_ADMIN', 'SUB_ADMIN'), felboCoinController.getCoinTrend);
router.get(
  '/users',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  felboCoinController.getUsersLeaderboard,
);

router.post(
  '/users/:userId/credit',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  felboCoinController.adminCreditCoins,
);
router.post(
  '/users/:userId/debit',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  felboCoinController.adminDebitCoins,
);

router.get('/admin-logs', authorize('SUPER_ADMIN', 'SUB_ADMIN'), felboCoinController.getAdminLogs);

export default router;
