import { Router } from 'express';
import { authorize } from '../../shared/middleware/authorize';
import { broadcastNotification } from '../../modules/admin/broadcast.controller';

const router = Router();

router.post('/broadcast', authorize('SUPER_ADMIN', 'SUB_ADMIN'), broadcastNotification);

export default router;
