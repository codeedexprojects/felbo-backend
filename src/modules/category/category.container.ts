import { logger } from '../../shared/logger/logger';
import { CategoryRepository } from './category.repository';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { ServiceRepository } from '../service/service.repository';

const categoryRepository = new CategoryRepository();
const serviceRepository = new ServiceRepository();
const categoryService = new CategoryService(categoryRepository, serviceRepository, logger);
const categoryController = new CategoryController(categoryService);

export { categoryRepository, categoryService, categoryController };
