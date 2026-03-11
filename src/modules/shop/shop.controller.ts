import { Request, Response } from 'express';
import ShopService from './shop.service';
import {
  createShopSchema,
  updateShopSchema,
  toggleAvailableSchema,
  updateWorkingHoursSchema,
  nearbyShopsSchema,
  recommendedShopsSchema,
  searchShopsSchema,
  shopIdParamSchema,
  shopIdOnboardingParamSchema,
  completeProfileSchema,
  adminSearchShopsSchema,
  shopServicesSchema,
} from './shop.validators';

export default class ShopController {
  constructor(private readonly shopService: ShopService) {}

  createShop = async (req: Request, res: Response): Promise<void> => {
    const { location, ...rest } = createShopSchema.parse(req.body);
    const result = await this.shopService.createShopForVendor({
      ...rest,
      vendorId: req.user!.sub,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
      },
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  getMyShops = async (req: Request, res: Response): Promise<void> => {
    const result = await this.shopService.getMyShopsWithBarberProfile(req.user!.sub);

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

  getNearbyShops = async (req: Request, res: Response): Promise<void> => {
    const validated = nearbyShopsSchema.parse(req.query);
    const result = await this.shopService.getNearbyShops({ ...validated, userId: req.user!.sub });

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getRecommendedShops = async (req: Request, res: Response): Promise<void> => {
    const validated = recommendedShopsSchema.parse(req.query);
    const result = await this.shopService.getRecommendedShops({
      ...validated,
      userId: req.user!.sub,
    });

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
    const result = await this.shopService.getShopDetails(id, req.user?.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getShopServices = async (req: Request, res: Response): Promise<void> => {
    const { id } = shopIdParamSchema.parse(req.params);
    const { type } = shopServicesSchema.parse(req.query);

    const result = await this.shopService.getShopServices({
      shopId: id,
      type,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  deleteShop = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const result = await this.shopService.deleteShop(shopId, req.user!.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  adminSearchShops = async (req: Request, res: Response): Promise<void> => {
    const validated = adminSearchShopsSchema.parse(req.query);
    const result = await this.shopService.adminSearchShops(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  toggleShopAvailable = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const validated = toggleAvailableSchema.parse(req.body);
    const result = await this.shopService.toggleShopAvailable(shopId, req.user!.sub, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
