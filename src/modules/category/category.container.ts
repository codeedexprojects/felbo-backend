import { logger } from '../../shared/logger/logger';
import { CategoryRepository } from './category.repository';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { serviceService } from '../service/service.container';
import { ServiceService } from '../service/service.service';

const categoryRepository = new CategoryRepository();
const categoryService = new CategoryService(
  categoryRepository,
  (): ServiceService => serviceService,
  logger,
);
const categoryController = new CategoryController(categoryService);

export { categoryRepository, categoryService, categoryController };
