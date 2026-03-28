import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  image: string;
  displayOrder: number;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    image: { type: String, required: true },
    displayOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DELETED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true },
);

categorySchema.index({ status: 1, displayOrder: 1 });
categorySchema.index({ isActive: 1, displayOrder: 1 });

export const CategoryModel = mongoose.model<ICategory>('Category', categorySchema);
