import mongoose, { Schema, Document } from 'mongoose';

export interface IBookingService {
  serviceId: mongoose.Types.ObjectId;
  serviceName: string;
  categoryName: string;
  durationMinutes: number;
  price: number;
}

export interface IBookingCancellation {
  cancelledAt: Date;
  cancelledBy: 'USER' | 'VENDOR';
  reason: string;
  refundAmount: number;
  refundCoins: number;
  refundType: 'FELBO_COINS' | 'ORIGINAL';
  refundStatus: 'PENDING' | 'COMPLETED';
}

export interface IBooking extends Document {
  bookingNumber: string;
  userId: mongoose.Types.ObjectId;
  userName: string;
  userPhone: string;
  shopId: mongoose.Types.ObjectId;
  shopName: string;
  barberId: mongoose.Types.ObjectId;
  barberName: string;
  barberSelectionType: 'SPECIFIC' | 'ANY_AVAILABLE';
  date: Date;
  startTime: string;
  endTime: string;
  totalDurationMinutes: number;
  services: IBookingService[];
  totalServiceAmount: number;
  advancePaid: number;
  remainingAmount: number;
  paymentMethod: 'RAZORPAY' | 'FELBO_COINS';
  paymentId?: string;
  razorpayOrderId?: string;
  status:
    | 'PENDING_PAYMENT'
    | 'CONFIRMED'
    | 'COMPLETED'
    | 'CANCELLED_BY_USER'
    | 'CANCELLED_BY_VENDOR'
    | 'NO_SHOW';
  verificationCode: string;
  cancellation?: IBookingCancellation;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingServiceSubSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true },
    categoryName: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false },
);

const cancellationSubSchema = new Schema(
  {
    cancelledAt: { type: Date, required: true },
    cancelledBy: { type: String, enum: ['USER', 'VENDOR'], required: true },
    reason: { type: String, required: true },
    refundAmount: { type: Number, required: true },
    refundCoins: { type: Number, default: 0 },
    refundType: { type: String, enum: ['FELBO_COINS', 'ORIGINAL'], required: true },
    refundStatus: { type: String, enum: ['PENDING', 'COMPLETED'], required: true },
  },
  { _id: false },
);

const bookingSchema = new Schema<IBooking>(
  {
    bookingNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userPhone: { type: String, required: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    shopName: { type: String, required: true },
    barberId: { type: Schema.Types.ObjectId, ref: 'Barber', required: true },
    barberName: { type: String, required: true },
    barberSelectionType: {
      type: String,
      enum: ['SPECIFIC', 'ANY_AVAILABLE'],
      required: true,
    },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    totalDurationMinutes: { type: Number, required: true },
    services: { type: [bookingServiceSubSchema], required: true },
    totalServiceAmount: { type: Number, required: true },
    advancePaid: { type: Number, required: true },
    remainingAmount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['RAZORPAY', 'FELBO_COINS'],
      required: true,
    },
    paymentId: { type: String },
    razorpayOrderId: { type: String },
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'CONFIRMED',
        'COMPLETED',
        'CANCELLED_BY_USER',
        'CANCELLED_BY_VENDOR',
        'NO_SHOW',
      ],
      required: true,
    },
    verificationCode: { type: String, required: true },
    cancellation: { type: cancellationSubSchema },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ shopId: 1, date: 1, status: 1 });
bookingSchema.index({ barberId: 1, date: 1, status: 1 });

export const BookingModel = mongoose.model<IBooking>('Booking', bookingSchema);

export interface ISlotLock extends Document {
  shopId: mongoose.Types.ObjectId;
  barberId: mongoose.Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  lockedBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const slotLockSchema = new Schema<ISlotLock>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    barberId: { type: Schema.Types.ObjectId, ref: 'Barber', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

slotLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
slotLockSchema.index({ barberId: 1, date: 1, startTime: 1 });

export const SlotLockModel = mongoose.model<ISlotLock>('SlotLock', slotLockSchema);
