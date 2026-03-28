import { Router } from 'express';
import { barberController } from '../../modules/barber/barber.container';

const router = Router();

router.post('/blocks', barberController.createSlotBlock);
router.patch('/blocks/:blockId/release', barberController.releaseSlotBlock);
router.get('/blocks', barberController.listSlotBlocks);

export default router;
