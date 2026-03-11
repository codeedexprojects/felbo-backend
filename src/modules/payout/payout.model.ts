import mongoose, { Schema, Document } from 'mongoose';

export type PayoutStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface IPayout extends Document {
  amount: number;
  bookingCount: number;
  status: PayoutStatus;
  requestedBy: mongoose.Types.ObjectId;
  processedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    bookingCount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

payoutSchema.index({ status: 1 });
payoutSchema.index({ createdAt: -1 });

export const PayoutModel = mongoose.model<IPayout>('Payout', payoutSchema);
