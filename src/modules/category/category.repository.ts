import { CategoryModel, ICategory } from './category.model';
import { CreateCategoryInput, UpdateCategoryInput } from './category.types';

export class CategoryRepository {
  async create(data: CreateCategoryInput): Promise<ICategory> {
    return CategoryModel.create({
      name: data.name,
      image: data.image,
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

  async findAllActivePaginated(
    page: number,
    limit: number,
  ): Promise<{ categories: ICategory[]; total: number }> {
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      CategoryModel.find({ isActive: true })
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      CategoryModel.countDocuments({ isActive: true }).exec(),
    ]);

    return { categories, total };
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
