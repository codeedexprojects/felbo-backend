import { CategoryModel, ICategory } from './category.model';
import { CreateCategoryInput, UpdateCategoryInput } from './category.types';

export class CategoryRepository {
  async create(data: CreateCategoryInput): Promise<ICategory> {
    return CategoryModel.create({
      name: data.name,
      displayOrder: data.displayOrder ?? 0,
    });
  }

  findById(id: string): Promise<ICategory | null> {
    return CategoryModel.findById(id).exec();
  }

  findByName(name: string): Promise<ICategory | null> {
    return CategoryModel.findOne({ name }).exec();
  }

  findAllActive(): Promise<ICategory[]> {
    return CategoryModel.find({ isActive: true }).sort({ displayOrder: 1 }).exec();
  }

  findAll(): Promise<ICategory[]> {
    return CategoryModel.find().sort({ displayOrder: 1 }).exec();
  }

  updateById(id: string, data: UpdateCategoryInput): Promise<ICategory | null> {
    return CategoryModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }).exec();
  }

  softDelete(id: string): Promise<ICategory | null> {
    return CategoryModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { returnDocument: 'after' },
    ).exec();
  }
}
