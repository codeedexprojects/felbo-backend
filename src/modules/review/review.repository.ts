import mongoose from 'mongoose';
import ReviewModel, { IReview } from './review.model';

export interface ReviewPage {
  reviews: Array<IReview & { userName?: string; userPhoto?: string }>;
  total: number;
}

export interface ShopRatingStats {
  average: number;
  count: number;
}

export default class ReviewRepository {
  create(data: {
    bookingId: string;
    userId: string;
    shopId: string;
    barberId: string;
    rating: number;
    description?: string;
  }): Promise<IReview> {
    return ReviewModel.create(data);
  }

  findByBookingId(bookingId: string): Promise<IReview | null> {
    return ReviewModel.findOne({ bookingId }).lean<IReview>().exec();
  }

  async findPublishedByShop(shopId: string, page: number, limit: number): Promise<ReviewPage> {
    const skip = (page - 1) * limit;
    const matchFilter = { shopId: new mongoose.Types.ObjectId(shopId), status: 'PUBLISHED' };

    const pipeline: mongoose.PipelineStage[] = [
      { $match: matchFilter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, photo: 1 } }],
          as: 'user',
        },
      },
      {
        $addFields: {
          userRef: { $arrayElemAt: ['$user', 0] },
        },
      },
      {
        $project: {
          user: 0,
        },
      },
    ];

    const [reviewsRaw, total] = await Promise.all([
      ReviewModel.aggregate(pipeline).exec(),
      ReviewModel.countDocuments(matchFilter).exec(),
    ]);

    const reviews = reviewsRaw.map((r) => {
      const reviewDoc = { ...r };
      if (r.userRef) {
        reviewDoc.userName = r.userRef.name;
        reviewDoc.userPhoto = r.userRef.photo;
      }
      delete reviewDoc.userRef;
      return reviewDoc;
    });

    return { reviews, total };
  }

  async getShopRatingStats(shopId: string): Promise<ShopRatingStats> {
    const [result] = await ReviewModel.aggregate<{ average: number; count: number }>([
      { $match: { shopId: new mongoose.Types.ObjectId(shopId), status: 'PUBLISHED' } },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (!result) return { average: 0, count: 0 };
    return { average: Math.round(result.average * 10) / 10, count: result.count };
  }
}
