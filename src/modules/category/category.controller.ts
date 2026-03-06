import { Request, Response } from 'express';
import { CategoryService } from './category.service';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  listCategoriesSchema,
} from './category.validators';

export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const validated = createCategorySchema.parse(req.body);
    const result = await this.categoryService.createCategory(validated);

    res.status(201).json({ success: true, data: result });
  };

  getAll = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.categoryService.getAllCategories();

    res.status(200).json({ success: true, data: result });
  };

  listUserCategories = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = listCategoriesSchema.parse(req.query);
    const result = await this.categoryService.listUserCategories(page, limit);

    res.status(200).json({ success: true, data: result });
  };

  getAllAdmin = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.categoryService.getAllCategoriesAdmin();

    res.status(200).json({ success: true, data: result });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { categoryId } = categoryIdParamSchema.parse(req.params);
    const validated = updateCategorySchema.parse(req.body);
    const result = await this.categoryService.updateCategory(categoryId, validated);

    res.status(200).json({ success: true, data: result });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { categoryId } = categoryIdParamSchema.parse(req.params);
    await this.categoryService.deleteCategory(categoryId);

    res.status(200).json({ success: true, message: 'Category deleted successfully.' });
  };
}
