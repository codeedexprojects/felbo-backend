import { Router } from 'express';
import { categoryController } from '../../modules/category/category.container';

const router = Router({ mergeParams: true });

router.get('/', categoryController.getAll);

export default router;
