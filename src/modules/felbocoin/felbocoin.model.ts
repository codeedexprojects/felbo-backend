import mongoose, { Schema, Document, Types } from 'mongoose';
import { CoinTransactionDirection, CoinTransactionType } from './felbocoin.types';

export interface IFelboCoinTransaction extends Document {
  userId: Types.ObjectId;
  type: CoinTransactionType;
  direction: CoinTransactionDirection;
  coins: number;
  balanceBefore: number;
  balanceAfter: number;
  bookingId?: Types.ObjectId;
  bookingNumber?: string;
  adminId?: Types.ObjectId;
  description: string;
  createdAt: Date;
}

const felboCoinTransactionSchema = new Schema<IFelboCoinTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'COIN_EARNED',
        'COIN_REDEEMED',
        'COIN_REFUND',
        'COIN_REVERSAL',
        'ADMIN_CREDIT',
        'ADMIN_DEBIT',
      ],
      required: true,
    },
    direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    coins: { type: Number, required: true, min: 0 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    bookingNumber: { type: String },
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
    description: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

felboCoinTransactionSchema.index({ userId: 1, createdAt: -1 });

export const FelboCoinTransactionModel = mongoose.model<IFelboCoinTransaction>(
  'FelboCoinTransaction',
  felboCoinTransactionSchema,
);
