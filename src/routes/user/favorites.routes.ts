import { Router } from 'express';
import { favoriteController } from '../../modules/favorite/favorite.container';

const router = Router();

router.post('/', favoriteController.add);
router.delete('/:shopId', favoriteController.remove);
router.get('/', favoriteController.list);

export default router;
