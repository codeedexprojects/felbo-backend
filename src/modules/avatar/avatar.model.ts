import mongoose, { Schema, Document } from 'mongoose';

export interface IAvatar extends Document {
  imageUrl: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;
}

const avatarSchema = new Schema<IAvatar>(
  {
    imageUrl: { type: String, required: true },
    key: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
  },
);

export const AvatarModel = mongoose.model<IAvatar>('Avatar', avatarSchema);
