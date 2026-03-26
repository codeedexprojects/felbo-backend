import { Router } from 'express';
import { notificationController } from '../../modules/notification/notification.container';

const router = Router();

router.get('/', (req, res) => notificationController.listForVendor(req, res));
router.patch('/read-all', (req, res) => notificationController.markAllReadForVendor(req, res));
router.patch('/:id/read', (req, res) => notificationController.markOneReadForVendor(req, res));

export default router;
