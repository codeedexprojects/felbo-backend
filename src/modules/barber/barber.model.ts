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
  status: 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
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
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

barberSchema.index({ shopId: 1, isActive: 1 });
barberSchema.index({ username: 1 }, { unique: true, sparse: true });
barberSchema.index({ vendorId: 1, isActive: 1 });
barberSchema.index({ shopId: 1, phone: 1 }, { unique: true });

export const BarberModel = mongoose.model<IBarber>('Barber', barberSchema);

export interface IBarberService extends Document {
  barberId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const barberServiceSchema = new Schema<IBarberService>(
  {
    barberId: { type: Schema.Types.ObjectId, ref: 'Barber', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    price: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

barberServiceSchema.index({ barberId: 1, isActive: 1 });
barberServiceSchema.index({ shopId: 1, isActive: 1 });
barberServiceSchema.index({ barberId: 1, serviceId: 1 }, { unique: true });

export const BarberServiceModel = mongoose.model<IBarberService>(
  'BarberService',
  barberServiceSchema,
);
