import { Router } from 'express';
import { notificationController } from '../../modules/notification/notification.container';

const router = Router();

router.get('/', (req, res) => notificationController.listForUser(req, res));
router.patch('/read-all', (req, res) => notificationController.markAllReadForUser(req, res));
router.patch('/:id/read', (req, res) => notificationController.markOneReadForUser(req, res));

export default router;
