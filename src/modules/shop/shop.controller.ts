import { Request, Response } from 'express';
import ShopService from './shop.service';
import {
  updateShopSchema,
  updateWorkingHoursSchema,
  nearbyShopsSchema,
  searchShopsSchema,
  shopIdParamSchema,
  shopDetailsQuerySchema,
  shopIdOnboardingParamSchema,
  completeProfileSchema,
  addCategorySchema,
} from './shop.validators';

export default class ShopController {
  constructor(private readonly shopService: ShopService) {}

  getMyShops = async (req: Request, res: Response): Promise<void> => {
    const result = await this.shopService.getMyShops(req.user!.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getShop = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const result = await this.shopService.getShop(shopId, req.user!.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateShop = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const validated = updateShopSchema.parse(req.body);
    const result = await this.shopService.updateShop(shopId, req.user!.sub, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateWorkingHours = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const validated = updateWorkingHoursSchema.parse(req.body);
    const result = await this.shopService.updateWorkingHours(shopId, req.user!.sub, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  completeProfile = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const validated = completeProfileSchema.parse(req.body);
    const result = await this.shopService.completeProfile(shopId, req.user!.sub, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  addCategory = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const validated = addCategorySchema.parse(req.body);
    const result = await this.shopService.addCategory(shopId, req.user!.sub, validated);

    res.status(201).json({
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

  getShopDetails = async (req: Request, res: Response): Promise<void> => {
    const { id } = shopIdParamSchema.parse(req.params);
    const { latitude, longitude } = shopDetailsQuerySchema.parse(req.query);
    const result = await this.shopService.getShopDetails(id, { latitude, longitude });

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
