import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorAddress {
  line1: string;
  line2?: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface IVendorLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IVendorShopDetails {
  name: string;
  type: 'MENS' | 'WOMENS' | 'UNISEX';
  address: IVendorAddress;
  location: IVendorLocation;
  photos: string[];
}

export interface IVendorRegistrationPayment {
  amount: number;
  paymentId: string;
  paidAt: Date;
}

export interface IVendorDocuments {
  shopLicense?: string;
  ownerIdProof?: string;
}

export interface IVendor extends Document {
  phone: string;
  email?: string;
  ownerName: string;
  profilePhoto?: string;

  registrationType: 'ASSOCIATION' | 'INDEPENDENT';

  // Association details
  associationMemberId?: string;
  associationIdProofUrl?: string;

  // Independent payment
  registrationPayment?: IVendorRegistrationPayment;
  registrationPaymentOrderId?: string;

  // Documents
  documents?: IVendorDocuments;

  // Shop details (temporary storage during registration)
  shopDetails?: IVendorShopDetails;

  // Verification
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYMENT_PENDING';
  verificationNote?: string;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;

  // Notification settings
  notificationSettings: {
    voiceAnnouncements: boolean;
  };

  // Cancellation tracking
  cancellationCount: number;
  cancellationsThisWeek: number;
  lastCancellationAt?: Date;
  isFlagged: boolean;
  flaggedAt?: Date;

  // Fcm tokens for push notifications
  fcmTokens: string[];

  // Block status
  isBlocked: boolean;
  blockedAt?: Date;
  blockedBy?: mongoose.Types.ObjectId;
  blockReason?: string;

  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  refreshTokenHash?: string | null;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema(
  {
    line1: { type: String },
    line2: { type: String },
    area: { type: String },
    city: { type: String },
    district: { type: String },
    state: { type: String },
    pincode: { type: String },
  },
  { _id: false },
);

const locationSchema = new Schema(
  {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number] },
  },
  { _id: false },
);

const shopDetailsSchema = new Schema(
  {
    name: { type: String },
    type: { type: String, enum: ['MENS', 'WOMENS', 'UNISEX'] },
    address: { type: addressSchema },
    location: { type: locationSchema },
    photos: { type: [String], default: [] },
  },
  { _id: false },
);

const vendorSchema = new Schema<IVendor>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      default: null,
    },
    ownerName: {
      type: String,
      default: '',
    },
    profilePhoto: {
      type: String,
      default: null,
    },

    registrationType: {
      type: String,
      enum: ['ASSOCIATION', 'INDEPENDENT'],
    },

    // Association details
    associationMemberId: { type: String },
    associationIdProofUrl: { type: String },

    // Independent payment
    registrationPayment: {
      amount: { type: Number },
      paymentId: { type: String },
      paidAt: { type: Date },
    },
    registrationPaymentOrderId: { type: String },

    // Documents
    documents: {
      shopLicense: { type: String },
      ownerIdProof: { type: String },
    },

    // Shop details
    shopDetails: { type: shopDetailsSchema },

    // Verification
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    verificationNote: { type: String },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },

    // Notification settings
    notificationSettings: {
      voiceAnnouncements: { type: Boolean, default: true },
    },

    // Cancellation tracking
    cancellationCount: { type: Number, default: 0 },
    cancellationsThisWeek: { type: Number, default: 0 },
    lastCancellationAt: { type: Date },
    isFlagged: { type: Boolean, default: false },
    flaggedAt: { type: Date },

    fcmTokens: {
      type: [String],
      default: [],
      select: false,
    },

    // Block status
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    blockReason: { type: String },

    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'],
      default: 'PENDING',
    },
    refreshTokenHash: { type: String, default: null },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// Indexes
vendorSchema.index({ verificationStatus: 1 });
vendorSchema.index({ status: 1 });
vendorSchema.index({ isBlocked: 1 });
vendorSchema.index({ isFlagged: 1 });
vendorSchema.index({ registrationType: 1 });
vendorSchema.index({ 'shopDetails.location': '2dsphere' });

export const VendorModel = mongoose.model<IVendor>('Vendor', vendorSchema);
