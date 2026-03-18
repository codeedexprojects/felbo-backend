import { Router } from 'express';
import { avatarController } from '../../modules/avatar/avatar.container';

const router = Router();

router.get('/', avatarController.listAvatars);

export default router;
