import mongoose, { Schema, Document } from 'mongoose';

export interface IBarberService extends Document {
  barberId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
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

// Service Model
export interface IService extends Document {
  shopId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  applicableFor: 'MENS' | 'WOMENS' | 'ALL';
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true },
    basePrice: { type: Number, required: true },
    baseDurationMinutes: { type: Number, required: true },
    applicableFor: {
      type: String,
      enum: ['MENS', 'WOMENS', 'ALL'],
      required: true,
    },
    description: { type: String },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DELETED'],
      default: 'ACTIVE',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

serviceSchema.index({ shopId: 1, isActive: 1 });
serviceSchema.index({ shopId: 1, categoryId: 1, isActive: 1 });
serviceSchema.index({ shopId: 1, name: 1 }, { unique: true });

export const ServiceModel = mongoose.model<IService>('Service', serviceSchema);
