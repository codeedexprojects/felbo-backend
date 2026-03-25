import { Router } from 'express';
import { issueController } from '../../modules/issue/issue.container';

const router = Router();

router.post('/', issueController.createIssue);
router.get('/', issueController.listUserIssues);
router.get('/:id', issueController.getUserIssueDetail);

export default router;
