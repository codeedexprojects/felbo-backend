import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    displayOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ isActive: 1, displayOrder: 1 });

export const CategoryModel = mongoose.model<ICategory>('Category', categorySchema);
