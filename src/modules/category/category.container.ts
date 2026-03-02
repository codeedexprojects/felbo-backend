import { logger } from '../../shared/logger/logger';
import { CategoryRepository } from './category.repository';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';

const categoryRepository = new CategoryRepository();
const categoryService = new CategoryService(categoryRepository, logger);
const categoryController = new CategoryController(categoryService);

export { categoryRepository, categoryService, categoryController };
