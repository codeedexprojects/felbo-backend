import mongoose, { Schema, Document } from 'mongoose';

export type AdminRole = 'SUPER_ADMIN' | 'SUB_ADMIN' | 'ASSOCIATION_ADMIN';
export type AdminStatus = 'ACTIVE' | 'INACTIVE';

export interface IAdmin extends Document {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  refreshTokenHash?: string;
  role: AdminRole;
  status: AdminStatus;
  createdBy?: mongoose.Types.ObjectId;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSOCIATION_ADMIN'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

adminSchema.index({ role: 1, status: 1 });

export const AdminModel = mongoose.model<IAdmin>('Admin', adminSchema);
