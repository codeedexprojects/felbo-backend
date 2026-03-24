import { Router } from 'express';
import { eventController } from '../../modules/event/event.container';

const router = Router();

router.get('/', eventController.listPublicEvents);

export default router;
