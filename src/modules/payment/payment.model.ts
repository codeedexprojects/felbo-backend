import mongoose, { Schema, Document } from 'mongoose';

export interface IRefundEntry {
  razorpayRefundId: string;
  amountPaise: number;
  status: 'INITIATED' | 'PROCESSED' | 'FAILED';
  initiatedAt: Date;
  processedAt?: Date;
}

export interface IPayment extends Document {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  purpose: 'VENDOR_REGISTRATION' | 'BOOKING_ADVANCE';
  amountPaise: number;
  currency: string;
  phone?: string;
  userId?: string;
  shopId?: string;
  receipt: string;
  notes?: Record<string, string>;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
  paidAt?: Date;
  refunds: IRefundEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const refundEntrySchema = new Schema(
  {
    razorpayRefundId: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    status: {
      type: String,
      enum: ['INITIATED', 'PROCESSED', 'FAILED'],
      required: true,
    },
    initiatedAt: { type: Date, required: true },
    processedAt: { type: Date },
  },
  { _id: false },
);

const paymentSchema = new Schema<IPayment>(
  {
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    purpose: {
      type: String,
      enum: ['VENDOR_REGISTRATION', 'BOOKING_ADVANCE'],
      required: true,
    },
    amountPaise: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    phone: { type: String },
    userId: { type: String },
    shopId: { type: String },
    receipt: { type: String, required: true },
    notes: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['CREATED', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'CREATED',
      required: true,
    },
    paidAt: { type: Date },
    refunds: { type: [refundEntrySchema], default: [] },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ razorpayOrderId: 1 }, { unique: true });
paymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
paymentSchema.index({ phone: 1 });
paymentSchema.index({ purpose: 1, status: 1 });

export const PaymentModel = mongoose.model<IPayment>('Payment', paymentSchema);
