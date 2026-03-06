import mongoose, { Schema, Document } from 'mongoose';

export interface IAd extends Document {
  title: string;
  subtitle: string;
  description: string;
  bannerImage: string;
  shopId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const advertisementSchema = new Schema<IAd>(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    bannerImage: { type: String, required: true },
    shopId: { type: Schema.Types.ObjectId, required: true, ref: 'Shop', index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'Admin' },
    priority: { type: Number, default: 0, unique: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  },
);

export const AdvertisementModel = mongoose.model<IAd>('Advertisement', advertisementSchema);
