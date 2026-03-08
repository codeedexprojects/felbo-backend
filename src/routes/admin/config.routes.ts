import { Router } from 'express';
import { configController } from '../../modules/config/config.container';
import { authorize } from '../../shared/middleware/authorize';

const router = Router();

router.get('/', authorize('SUPER_ADMIN'), configController.getAll);
router.get('/:category', authorize('SUPER_ADMIN'), configController.getByCategory);
router.patch('/:key', authorize('SUPER_ADMIN'), configController.updateConfig);

export default router;
