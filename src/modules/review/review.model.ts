import mongoose, { Schema, Document } from 'mongoose';

export type ReviewStatus = 'PUBLISHED' | 'FLAGGED' | 'REMOVED';

export interface IReview extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  barberId: mongoose.Types.ObjectId;
  rating: number;
  description?: string;
  status: ReviewStatus;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    barberId: { type: Schema.Types.ObjectId, ref: 'Barber', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    description: { type: String, maxlength: 150 },
    status: {
      type: String,
      enum: ['PUBLISHED', 'FLAGGED', 'REMOVED'],
      default: 'PUBLISHED',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

reviewSchema.index({ shopId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ barberId: 1, status: 1 });
reviewSchema.index({ userId: 1 });

const ReviewModel = mongoose.model<IReview>('Review', reviewSchema);

export default ReviewModel;
