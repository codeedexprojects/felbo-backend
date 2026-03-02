import { Router } from 'express';
import { issueController } from '../../modules/issue/issue.container';

const router = Router();

router.post('/', issueController.createIssue);

export default router;
