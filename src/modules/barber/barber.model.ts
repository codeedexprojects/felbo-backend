import mongoose, { Schema, Document } from 'mongoose';

export interface IBarber extends Document {
  shopId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  photo?: string;
  username?: string;
  passwordHash?: string;
  rating: {
    average: number;
    count: number;
  };
  status: 'ACTIVE' | 'DELETED';
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const barberSchema = new Schema<IBarber>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    photo: { type: String },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    username: { type: String },
    passwordHash: { type: String, select: false },
    status: {
      type: String,
      enum: ['ACTIVE', 'DELETED'],
      default: 'ACTIVE',
    },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true },
);

barberSchema.index({ shopId: 1, isAvailable: 1 });
barberSchema.index({ username: 1 }, { unique: true, sparse: true });
barberSchema.index({ vendorId: 1, isAvailable: 1 });
barberSchema.index({ shopId: 1, phone: 1 }, { unique: true });

export const BarberModel = mongoose.model<IBarber>('Barber', barberSchema);
