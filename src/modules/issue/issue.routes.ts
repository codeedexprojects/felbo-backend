import { Router } from 'express';
import { issueController } from './issue.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.post('/', authenticate, authorize('USER'), issueController.createIssue);
router.get('/', authenticate, authorize('SUPER_ADMIN', 'SUB_ADMIN'), issueController.listIssues);
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'SUB_ADMIN'), issueController.getIssue);
router.patch(
  '/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  issueController.updateIssueStatus,
);
router.post(
  '/:id/refund',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  issueController.processRefund,
);
router.post(
  '/:id/flag-vendor',
  authenticate,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  issueController.flagVendorForIssue,
);

export const issueRoutes = router;
