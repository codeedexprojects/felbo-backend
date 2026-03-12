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

  findByIds(ids: string[]): Promise<ICategory[]> {
    return CategoryModel.find({ _id: { $in: ids } })
      .lean()
      .exec() as unknown as Promise<ICategory[]>;
  }

  findByName(name: string): Promise<ICategory | null> {
    return CategoryModel.findOne({ name }).exec();
  }

  findAllActive(): Promise<ICategory[]> {
    return CategoryModel.find({ status: 'ACTIVE', isActive: true })
      .sort({ displayOrder: 1 })
      .exec();
  }

  async findAllActivePaginated(
    page: number,
    limit: number,
  ): Promise<{ categories: ICategory[]; total: number }> {
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      CategoryModel.find({ status: 'ACTIVE', isActive: true })
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      CategoryModel.countDocuments({ status: 'ACTIVE', isActive: true }).exec(),
    ]);

    return { categories, total };
  }

  findAll(): Promise<ICategory[]> {
    return CategoryModel.find({ status: { $ne: 'DELETED' } })
      .sort({ displayOrder: 1 })
      .exec();
  }

  updateById(id: string, data: UpdateCategoryInput): Promise<ICategory | null> {
    return CategoryModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }).exec();
  }

  softDelete(id: string): Promise<ICategory | null> {
    return CategoryModel.findByIdAndUpdate(
      id,
      { $set: { status: 'DELETED', isActive: false } },
      { returnDocument: 'after' },
    ).exec();
  }
}
