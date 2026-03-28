import { Router } from 'express';
import { financeController } from '../../modules/finance/finance.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/stats', authorize('SUPER_ADMIN'), financeController.getFinanceSummary);
router.get('/chart', authorize('SUPER_ADMIN'), financeController.getRevenueChart);
router.get('/vendors', authorize('SUPER_ADMIN'), financeController.getVendorRevenueTable);
router.get('/refunds', authorize('SUPER_ADMIN'), financeController.getRefundHistory);
router.get(
  '/registrations',
  authorize('SUPER_ADMIN'),
  financeController.getIndependentRegistrationList,
);

router.get(
  '/assoc/stats',
  authorize('ASSOCIATION_ADMIN'),
  financeController.getAssocFinanceSummary,
);
router.get(
  '/assoc/vendors',
  authorize('ASSOCIATION_ADMIN'),
  financeController.getAssocVendorRevenueTable,
);

export default router;
