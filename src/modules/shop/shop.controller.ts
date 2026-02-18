import { Request, Response } from 'express';
import ShopService from './shop.service';
import {
  updateShopSchema,
  updateWorkingHoursSchema,
  nearbyShopsSchema,
  searchShopsSchema,
  shopIdParamSchema,
} from './shop.validators';

export default class ShopController {
  constructor(private readonly shopService: ShopService) {}

  getMyShop = async (req: Request, res: Response): Promise<void> => {
    const result = await this.shopService.getMyShop(req.user!.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateMyShop = async (req: Request, res: Response): Promise<void> => {
    const validated = updateShopSchema.parse(req.body);
    const result = await this.shopService.updateMyShop(req.user!.userId, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateWorkingHours = async (req: Request, res: Response): Promise<void> => {
    const validated = updateWorkingHoursSchema.parse(req.body);
    const result = await this.shopService.updateWorkingHours(req.user!.userId, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getNearbyShops = async (req: Request, res: Response): Promise<void> => {
    const validated = nearbyShopsSchema.parse(req.query);
    const result = await this.shopService.getNearbyShops(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  searchShops = async (req: Request, res: Response): Promise<void> => {
    const validated = searchShopsSchema.parse(req.query);
    const result = await this.shopService.searchShops(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getShopById = async (req: Request, res: Response): Promise<void> => {
    const { id } = shopIdParamSchema.parse(req.params);
    const result = await this.shopService.getShopById(id);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
