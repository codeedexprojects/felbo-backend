import { Logger } from 'winston';
import { CategoryRepository } from './category.repository';
import { ICategory } from './category.model';
import { CreateCategoryInput, UpdateCategoryInput, CategoryDto } from './category.types';
import { ConflictError, NotFoundError } from '@shared/errors';

export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly logger: Logger,
  ) {}

  private toCategoryDto(category: ICategory): CategoryDto {
    return {
      id: category._id.toString(),
      name: category.name,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
    };
  }

  async createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
    const existing = await this.categoryRepository.findByName(input.name);
    if (existing) {
      throw new ConflictError('A category with this name already exists.');
    }

    const category = await this.categoryRepository.create(input);

    this.logger.info({
      action: 'CATEGORY_CREATED',
      module: 'category',
      categoryId: category._id.toString(),
      name: category.name,
    });

    return this.toCategoryDto(category);
  }

  async getAllCategories(): Promise<CategoryDto[]> {
    const categories = await this.categoryRepository.findAllActive();
    return categories.map((c) => this.toCategoryDto(c));
  }

  async getAllCategoriesAdmin(): Promise<CategoryDto[]> {
    const categories = await this.categoryRepository.findAll();
    return categories.map((c) => this.toCategoryDto(c));
  }

  async updateCategory(categoryId: string, input: UpdateCategoryInput): Promise<CategoryDto> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }

    if (input.name && input.name !== category.name) {
      const duplicate = await this.categoryRepository.findByName(input.name);
      if (duplicate) {
        throw new ConflictError('A category with this name already exists.');
      }
    }

    const updated = await this.categoryRepository.updateById(categoryId, input);
    if (!updated) {
      throw new NotFoundError('Category not found.');
    }

    this.logger.info({
      action: 'CATEGORY_UPDATED',
      module: 'category',
      categoryId,
    });

    return this.toCategoryDto(updated);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }

    await this.categoryRepository.softDelete(categoryId);

    this.logger.info({
      action: 'CATEGORY_DELETED',
      module: 'category',
      categoryId,
    });
  }

  async categoryExists(categoryId: string): Promise<boolean> {
    const category = await this.categoryRepository.findById(categoryId);
    return !!category && category.isActive;
  }
}
