import mongoose, { Schema, Document } from 'mongoose';

export interface IUserFavorite extends Document {
  userId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const userFavoriteSchema = new Schema<IUserFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

userFavoriteSchema.index({ userId: 1, shopId: 1 }, { unique: true });

export const UserFavoriteModel = mongoose.model<IUserFavorite>('UserFavorite', userFavoriteSchema);
