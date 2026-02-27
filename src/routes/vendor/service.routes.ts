import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';

const router = Router({ mergeParams: true });

router.post('/', shopController.addService);

export default router;
