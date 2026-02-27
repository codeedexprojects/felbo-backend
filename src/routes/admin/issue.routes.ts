// src/routes/admin/issue.routes.ts

import { Router } from 'express';
import { issueController } from '../../modules/issue/issue.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), issueController.listIssues);
router.get('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), issueController.getIssue);
router.patch(
  '/:id/status',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  issueController.updateIssueStatus,
);
router.post('/:id/refund', authorize('SUPER_ADMIN', 'SUB_ADMIN'), issueController.processRefund);
router.post(
  '/:id/flag-vendor',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  issueController.flagVendorForIssue,
);

export default router;
