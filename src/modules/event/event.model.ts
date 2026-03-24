import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  title: string;
  description: string;
  image: string;
  date?: Date;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    date: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'Admin' },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  },
);

export const EventModel = mongoose.model<IEvent>('Event', eventSchema);
