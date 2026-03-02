import { Router } from 'express';
import { categoryController } from '../../modules/category/category.container';

const router = Router();

router.post('/', categoryController.create);
router.get('/', categoryController.getAllAdmin);
router.patch('/:categoryId', categoryController.update);
router.delete('/:categoryId', categoryController.delete);

export default router;
