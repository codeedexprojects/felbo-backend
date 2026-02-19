import { Router } from 'express';
import { issueController } from './issue.container';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/', authenticate, authorize('SUPER_ADMIN', 'SUB_ADMIN'), issueController.listIssues);
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'SUB_ADMIN'), issueController.getIssue);

export const issueRoutes = router;
