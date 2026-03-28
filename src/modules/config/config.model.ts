import mongoose, { Schema, Document } from 'mongoose';

export type ConfigValueType = 'number' | 'string' | 'boolean';

export interface ISystemConfig extends Document {
  key: string;
  value: string;
  valueType: ConfigValueType;
  category: string;
  displayName: string;
  description: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const systemConfigSchema = new Schema<ISystemConfig>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
    },
    valueType: {
      type: String,
      enum: ['number', 'string', 'boolean'],
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  },
);

systemConfigSchema.index({ category: 1 });

export const SystemConfigModel = mongoose.model<ISystemConfig>('SystemConfig', systemConfigSchema);
