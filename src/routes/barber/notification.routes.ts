import { Router } from 'express';
import { notificationController } from '../../modules/notification/notification.container';

const router = Router();

router.get('/', (req, res) => notificationController.listForBarber(req, res));
router.patch('/read-all', (req, res) => notificationController.markAllReadForBarber(req, res));
router.patch('/:id/read', (req, res) => notificationController.markOneReadForBarber(req, res));
router.post('/test-notify', (req, res) => notificationController.sendTestNotification(req, res));

export default router;
