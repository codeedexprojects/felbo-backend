import { Router } from 'express';
import { felboCoinController } from '../../modules/felbocoin/felbocoin.container';

const router = Router();

router.get('/', felboCoinController.getFelboCoin);

export default router;
