import { logger } from '../../shared/logger/logger';
import ReviewRepository from './review.repository';
import ReviewService from './review.service';
import ReviewController from './review.controller';
import { bookingService } from '../booking/booking.container';
import { shopService } from '../shop/shop.container';

const reviewRepository = new ReviewRepository();

const reviewService = new ReviewService(
  reviewRepository,
  () => bookingService,
  () => shopService,
  logger,
);
const reviewController = new ReviewController(reviewService);

export { reviewService, reviewController };
