import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  name: string;
  email?: string;
  profileUrl?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  felboCoinBalance: number;
  cancellationCount: number;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  blockReason?: string | null;
  deactivatedAt?: Date | null;
  refreshTokenHash?: string | null;
  fcmTokens: string[];
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
    profileUrl: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      default: null,
    },
    felboCoinBalance: {
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
    blockReason: {
      type: String,
      default: null,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    fcmTokens: {
      type: [String],
      default: [],
      select: false,
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
