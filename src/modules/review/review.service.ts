import { Logger } from 'winston';
import ReviewRepository from './review.repository';
import { ReviewDto, ShopReviewsResponse } from './review.types';
import { IReview } from './review.model';
import { SubmitReviewInput } from './review.validators';
import { BookingService } from '../booking/booking.service';
import ShopService from '../shop/shop.service';
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/index';

export default class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly getBookingService: () => BookingService,
    private readonly getShopService: () => ShopService,
    private readonly logger: Logger,
  ) {}

  private get bookingService(): BookingService {
    return this.getBookingService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  async submitReview(userId: string, input: SubmitReviewInput): Promise<ReviewDto> {
    const booking = await this.bookingService.getBookingById(input.bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');

    if (booking.userId !== userId) {
      throw new ForbiddenError('You do not have access to this booking.');
    }

    if (booking.status !== 'COMPLETED') {
      throw new ConflictError('Booking is not yet completed.');
    }

    const existing = await this.reviewRepository.findByBookingId(input.bookingId);
    if (existing) {
      throw new ConflictError('Review already submitted for this booking.');
    }

    const { shopId, barberId } = booking;

    const review = await this.reviewRepository.create({
      bookingId: input.bookingId,
      userId,
      shopId,
      barberId,
      rating: input.rating,
      description: input.description,
    });

    // Recalculate and persist shop aggregate rating
    const stats = await this.reviewRepository.getShopRatingStats(shopId);
    await this.shopService.updateRating(shopId, stats.average, stats.count);

    this.logger.info({
      action: 'REVIEW_SUBMITTED',
      module: 'review',
      reviewId: review._id.toString(),
      bookingId: input.bookingId,
      shopId,
      userId,
      rating: input.rating,
    });

    return this.toDto(review);
  }

  async getShopReviews(shopId: string, page: number, limit: number): Promise<ShopReviewsResponse> {
    const [{ reviews, total }, stats] = await Promise.all([
      this.reviewRepository.findPublishedByShop(shopId, page, limit),
      this.reviewRepository.getShopRatingStats(shopId),
    ]);

    return {
      reviews: reviews.map((r) => this.toDto(r)),
      average: stats.average,
      count: stats.count,
      page,
      limit,
      total,
    };
  }

  private toDto(review: IReview): ReviewDto {
    return {
      id: review._id.toString(),
      bookingId: review.bookingId.toString(),
      userId: review.userId.toString(),
      shopId: review.shopId.toString(),
      barberId: review.barberId.toString(),
      rating: review.rating,
      description: review.description,
      status: review.status,
      createdAt: review.createdAt,
    };
  }
}
