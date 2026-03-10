import { Router } from 'express';
import { reviewController } from '../../modules/review/review.container';

const router = Router();

router.post('/', reviewController.submitReview);
router.get('/shop/:shopId', reviewController.getShopReviews);

export default router;
