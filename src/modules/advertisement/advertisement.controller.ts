import { Request, Response } from 'express';
import { AdvertisementService } from './advertisement.service';
import {
  createAdSchema,
  updateAdSchema,
  adIdParamSchema,
  listAdsSchema,
} from './advertisement.validators';

export class AdvertisementController {
  constructor(private readonly advertisementService: AdvertisementService) {}

  createAd = async (req: Request, res: Response): Promise<void> => {
    const validated = createAdSchema.parse(req.body);
    const adminId = req.user!.sub;
    const ad = await this.advertisementService.createAd(validated, adminId);
    res.status(201).json({ success: true, data: ad });
  };

  listAds = async (req: Request, res: Response): Promise<void> => {
    const validated = listAdsSchema.parse(req.query);
    const result = await this.advertisementService.listAds(validated);
    res.status(200).json({ success: true, data: result });
  };

  getAd = async (req: Request, res: Response): Promise<void> => {
    const { id } = adIdParamSchema.parse(req.params);
    const ad = await this.advertisementService.getAdById(id);
    res.status(200).json({ success: true, data: ad });
  };

  updateAd = async (req: Request, res: Response): Promise<void> => {
    const { id } = adIdParamSchema.parse(req.params);
    const validated = updateAdSchema.parse(req.body);
    const ad = await this.advertisementService.updateAd(id, validated);
    res.status(200).json({ success: true, data: ad });
  };

  deleteAd = async (req: Request, res: Response): Promise<void> => {
    const { id } = adIdParamSchema.parse(req.params);
    await this.advertisementService.deleteAd(id);
    res.status(200).json({ success: true, message: 'Advertisement deleted successfully.' });
  };
}
