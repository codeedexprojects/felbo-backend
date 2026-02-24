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

export interface IEmbeddedCategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  onboardingStatus:
    | 'PENDING_PROFILE'
    | 'PENDING_CATEGORIES'
    | 'PENDING_SERVICES'
    | 'PENDING_BARBERS'
    | 'COMPLETED';
  categories: IEmbeddedCategory[];
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

const categorySchema = new Schema<IEmbeddedCategory>(
  {
    name: { type: String, required: true },
    displayOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
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
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DELETED'],
      default: 'ACTIVE',
    },
    onboardingStatus: {
      type: String,
      enum: [
        'PENDING_PROFILE',
        'PENDING_CATEGORIES',
        'PENDING_SERVICES',
        'PENDING_BARBERS',
        'COMPLETED',
      ],
      default: 'PENDING_PROFILE',
    },
    categories: { type: [categorySchema], default: [] },
  },
  {
    timestamps: true,
  },
);

shopSchema.index({ vendorId: 1 });
shopSchema.index({ location: '2dsphere' });
shopSchema.index({ shopType: 1 });
shopSchema.index({ status: 1, isActive: 1 });
shopSchema.index({ 'rating.average': -1 });
shopSchema.index({ 'address.city': 1 });
shopSchema.index({ onboardingStatus: 1 });

export const ShopModel = mongoose.model<IShop>('Shop', shopSchema);

// Service Model
export interface IService extends Document {
  shopId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  applicableFor: 'MENS' | 'WOMENS' | 'ALL';
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
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
      enum: ['ACTIVE', 'INACTIVE'],
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

// Barber Model
export interface IBarber extends Document {
  shopId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  photo?: string;
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
barberSchema.index({ vendorId: 1, isActive: 1 });
barberSchema.index({ shopId: 1, phone: 1 }, { unique: true });

export const BarberModel = mongoose.model<IBarber>('Barber', barberSchema);

// BarberService Model
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
