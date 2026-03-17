import mongoose, { Schema, Document } from 'mongoose';
import { IssueStatus, IssueType, RefundStatus } from './issue.types';

export interface IBookingIssue extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  barberId?: mongoose.Types.ObjectId | null;
  type: IssueType;
  description: string;
  status: IssueStatus;
  reviewedBy?: mongoose.Types.ObjectId | null;
  adminNote?: string | null;
  razorpayPaymentId?: string | null;
  refundId?: string | null;
  userLocation?: { lat: number; lng: number } | null;
  refundStatus: RefundStatus;
  createdAt: Date;
  updatedAt: Date;
}

const bookingIssueSchema = new Schema<IBookingIssue>(
  {
    bookingId: { type: Schema.Types.ObjectId, required: true, ref: 'Booking', index: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    shopId: { type: Schema.Types.ObjectId, required: true, ref: 'Shop' },
    vendorId: { type: Schema.Types.ObjectId, required: true, ref: 'Vendor', index: true },
    barberId: { type: Schema.Types.ObjectId, ref: 'Barber', default: null },
    type: {
      type: String,
      enum: [
        'SHOP_CLOSED',
        'BARBER_UNAVAILABLE',
        'EXCESSIVE_WAIT',
        'SERVICE_NOT_PROVIDED',
        'QUALITY_ISSUE',
        'OTHER',
      ],
      required: true,
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'RESOLVED', 'REJECTED'],
      default: 'OPEN',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    adminNote: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    refundId: { type: String, default: null },
    userLocation: {
      type: { lat: Number, lng: Number },
      default: null,
    },
    refundStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'ISSUED', 'COMPLETED', 'FAILED'],
      default: 'NONE',
    },
  },
  {
    timestamps: true,
  },
);

bookingIssueSchema.index({ status: 1, createdAt: -1 });

export const BookingIssueModel = mongoose.model<IBookingIssue>('BookingIssue', bookingIssueSchema);
