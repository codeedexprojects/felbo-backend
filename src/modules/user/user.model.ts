import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  name: string;
  email?: string;
  walletBalance: number;
  cancellationCount: number;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: null,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    cancellationCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'BLOCKED', 'DELETED'],
      default: 'ACTIVE',
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const UserModel = mongoose.model<IUser>('User', userSchema);
