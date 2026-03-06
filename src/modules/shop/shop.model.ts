import mongoose, { Schema, Document } from 'mongoose';

export interface IShopAddress {
  line1: string;
  line2?: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface IShopLocation {
  type: 'Point';
  coordinates: [number, number];
}

export interface IDayHours {
  open: string;
  close: string;
  isOpen: boolean;
}

export interface IWorkingHours {
  monday: IDayHours;
  tuesday: IDayHours;
  wednesday: IDayHours;
  thursday: IDayHours;
  friday: IDayHours;
  saturday: IDayHours;
  sunday: IDayHours;
}

export interface IShop extends Document {
  vendorId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  phone: string;
  address: IShopAddress;
  location: IShopLocation;
  workingHours?: IWorkingHours;
  photos: string[];
  rating: {
    average: number;
    count: number;
  };
  isAvailable: boolean;
  status: 'ACTIVE' | 'DELETED';
  onboardingStatus:
    | 'PENDING_PROFILE'
    | 'PENDING_SERVICES'
    | 'PENDING_BARBERS'
    | 'PENDING_BARBER_SERVICES'
    | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema(
  {
    line1: { type: String, required: true },
    line2: { type: String },
    area: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false },
);

const locationSchema = new Schema(
  {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const dayHoursSchema = new Schema(
  {
    open: { type: String, required: true },
    close: { type: String, required: true },
    isOpen: { type: Boolean, required: true },
  },
  { _id: false },
);

const workingHoursSchema = new Schema(
  {
    monday: { type: dayHoursSchema },
    tuesday: { type: dayHoursSchema },
    wednesday: { type: dayHoursSchema },
    thursday: { type: dayHoursSchema },
    friday: { type: dayHoursSchema },
    saturday: { type: dayHoursSchema },
    sunday: { type: dayHoursSchema },
  },
  { _id: false },
);

const shopSchema = new Schema<IShop>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    shopType: {
      type: String,
      enum: ['MENS', 'WOMENS', 'UNISEX'],
      required: true,
    },
    phone: { type: String, required: true },
    address: { type: addressSchema, required: true },
    location: { type: locationSchema, required: true },
    workingHours: { type: workingHoursSchema },
    photos: { type: [String], default: [] },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    isAvailable: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'DELETED'],
      default: 'ACTIVE',
    },
    onboardingStatus: {
      type: String,
      enum: [
        'PENDING_PROFILE',
        'PENDING_SERVICES',
        'PENDING_BARBERS',
        'PENDING_BARBER_SERVICES',
        'COMPLETED',
      ],
      default: 'PENDING_PROFILE',
    },
  },
  {
    timestamps: true,
  },
);

shopSchema.index({ vendorId: 1 });
shopSchema.index({ location: '2dsphere' });
shopSchema.index({ shopType: 1 });
shopSchema.index({ status: 1, isAvailable: 1 });
shopSchema.index({ 'rating.average': -1 });
shopSchema.index({ 'address.city': 1 });
shopSchema.index({ onboardingStatus: 1 });

export const ShopModel = mongoose.model<IShop>('Shop', shopSchema);
