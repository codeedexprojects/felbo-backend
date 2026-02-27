// src/routes/vendor/service.routes.ts

import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';

// mergeParams ensures :shopId from the parent path is accessible in handlers
const router = Router({ mergeParams: true });

router.post('/', shopController.addService);

export default router;
