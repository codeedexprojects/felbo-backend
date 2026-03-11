import { Request, Response } from 'express';
import ReviewService from './review.service';
import { submitReviewSchema, shopIdParamSchema, paginationSchema } from './review.validators';

export default class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  submitReview = async (req: Request, res: Response): Promise<void> => {
    const input = submitReviewSchema.parse(req.body);
    const result = await this.reviewService.submitReview(req.user!.sub, input);
    res.status(201).json({ success: true, data: result });
  };

  getShopReviews = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await this.reviewService.getShopReviews(shopId, page, limit);
    res.status(200).json({ success: true, data: result });
  };
}
