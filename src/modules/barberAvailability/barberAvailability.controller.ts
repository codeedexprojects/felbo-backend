import { Request, Response } from 'express';
import { BarberAvailabilityService } from './barberAvailability.service';
import { createPresetSchema, setAvailabilitySchema } from './barberAvailability.validators';
import { z } from 'zod';

const presetIdSchema = z.object({ presetId: z.string().min(1) });

export class BarberAvailabilityController {
  constructor(private readonly availabilityService: BarberAvailabilityService) {}

  createPreset = async (req: Request, res: Response): Promise<void> => {
    const input = createPresetSchema.parse(req.body);
    const result = await this.availabilityService.createPreset(req.user!.sub, input);
    res.status(201).json({ success: true, data: result });
  };

  listPresets = async (req: Request, res: Response): Promise<void> => {
    const result = await this.availabilityService.listPresets(req.user!.sub);
    res.status(200).json({ success: true, data: result });
  };

  deletePreset = async (req: Request, res: Response): Promise<void> => {
    const { presetId } = presetIdSchema.parse(req.params);
    await this.availabilityService.deletePreset(req.user!.sub, presetId);
    res.status(200).json({ success: true, data: null });
  };

  applyPreset = async (req: Request, res: Response): Promise<void> => {
    const { presetId } = presetIdSchema.parse(req.params);
    const result = await this.availabilityService.applyPreset(req.user!.sub, presetId);
    res.status(200).json({ success: true, data: result });
  };

  setAvailability = async (req: Request, res: Response): Promise<void> => {
    const input = setAvailabilitySchema.parse(req.body);
    const result = await this.availabilityService.setTodayAvailability(req.user!.sub, input);
    res.status(200).json({ success: true, data: result });
  };

  getAvailability = async (req: Request, res: Response): Promise<void> => {
    const result = await this.availabilityService.getTodayAvailability(req.user!.sub);
    res.status(200).json({ success: true, data: result });
  };

  getDefault = async (req: Request, res: Response): Promise<void> => {
    const result = await this.availabilityService.getTodayDefault(req.user!.sub);
    res.status(200).json({ success: true, data: result });
  };
}
