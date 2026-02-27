// src/routes/vendor/category.routes.ts

import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';

// mergeParams ensures :shopId from the parent path is accessible in handlers
const router = Router({ mergeParams: true });

router.post('/', shopController.addCategory);

export default router;
