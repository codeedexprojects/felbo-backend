import mongoose, { Schema } from 'mongoose';

export interface IPresetItem {
  _id: mongoose.Types.ObjectId;
  name: string;
  workingHours: { start: string; end: string };
  breaks: Array<{ start: string; end: string; reason?: string }>;
  createdAt: Date;
}

export interface IBarberAvailability {
  _id: mongoose.Types.ObjectId;
  barberId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  presets: IPresetItem[];

  date?: Date;
  isWorking?: boolean;
  workingHours?: { start: string; end: string };
  breaks: Array<{ start: string; end: string; reason?: string }>;

  createdAt: Date;
  updatedAt: Date;
}

const breakSubSchema = new Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
    reason: { type: String },
  },
  { _id: false },
);

const presetSubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    workingHours: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    breaks: { type: [breakSubSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const barberAvailabilitySchema = new Schema<IBarberAvailability>(
  {
    barberId: { type: Schema.Types.ObjectId, ref: 'Barber', required: true, unique: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    presets: { type: [presetSubSchema], default: [] },

    date: { type: Date },
    isWorking: { type: Boolean },
    workingHours: {
      start: { type: String },
      end: { type: String },
    },
    breaks: { type: [breakSubSchema], default: [] },
  },
  { timestamps: true },
);

export const BarberAvailabilityModel = mongoose.model<IBarberAvailability>(
  'BarberAvailability',
  barberAvailabilitySchema,
);
