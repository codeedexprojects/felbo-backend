import { Logger } from 'winston';
import { CategoryRepository } from './category.repository';
import { ICategory } from './category.model';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryDto,
  ListUserCategoriesResponse,
} from './category.types';
import { ConflictError, NotFoundError } from '../../shared/errors/index';
import { ServiceService } from '../service/service.service';

export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly getServiceService: () => ServiceService,
    private readonly logger: Logger,
  ) {}

  private get serviceService(): ServiceService {
    return this.getServiceService();
  }

  private toCategoryDto(category: ICategory): CategoryDto {
    return {
      id: category._id.toString(),
      name: category.name,
      image: category.image,
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
  async listUserCategories(page: number, limit: number): Promise<ListUserCategoriesResponse> {
    const { categories, total } = await this.categoryRepository.findAllActivePaginated(page, limit);

    return {
      categories: categories.map((c) => ({
        id: c._id?.toString() ?? '',
        name: c.name,
        image: c.image,
      })),
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  async updateCategory(categoryId: string, input: UpdateCategoryInput): Promise<CategoryDto> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category || category.status === 'DELETED') {
      throw new NotFoundError('Category not found.');
    }

    if (input.name && input.name !== category.name) {
      const duplicate = await this.categoryRepository.findByName(input.name);
      if (duplicate && duplicate.status !== 'DELETED') {
        throw new ConflictError('A category with this name already exists.');
      }
    }

    // Map isActive to status if provided
    const updateData: UpdateCategoryInput = { ...input };
    if (input.isActive !== undefined) {
      updateData.status = input.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    const updated = await this.categoryRepository.updateById(categoryId, updateData);
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

  async toggleCategoryStatus(categoryId: string, isActive: boolean): Promise<CategoryDto> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category || category.status === 'DELETED') {
      throw new NotFoundError('Category not found.');
    }

    // If disabling, check for services
    if (!isActive) {
      const activeServiceCount = await this.serviceService.countActiveByCategoryId(categoryId);
      if (activeServiceCount > 0) {
        throw new ConflictError(
          `Cannot disable category: ${activeServiceCount} active service(s) are using it.`,
        );
      }
    }

    const updated = await this.categoryRepository.updateById(categoryId, {
      isActive,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
    });

    if (!updated) {
      throw new NotFoundError('Category not found.');
    }

    this.logger.info({
      action: 'CATEGORY_STATUS_TOGGLED',
      module: 'category',
      categoryId,
      isActive,
    });

    return this.toCategoryDto(updated);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category || category.status === 'DELETED') {
      throw new NotFoundError('Category not found.');
    }

    const activeServiceCount = await this.serviceService.countActiveByCategoryId(categoryId);
    if (activeServiceCount > 0) {
      throw new ConflictError(
        `Cannot delete category: ${activeServiceCount} active service(s) are using it.`,
      );
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
    return !!category && category.status === 'ACTIVE' && category.isActive;
  }

  async getCategoryNamesByIds(ids: string[]): Promise<Map<string, string>> {
    const categories = await this.categoryRepository.findByIds(ids);
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c._id.toString(), c.name);
    }
    return map;
  }
}
