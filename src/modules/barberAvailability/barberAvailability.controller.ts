import { Request, Response } from 'express';
import { BarberAvailabilityService } from './barberAvailability.service';
import { createPresetSchema, setAvailabilitySchema } from './barberAvailability.validators';
import { ForbiddenError } from '../../shared/errors/index';
import { z } from 'zod';

const presetIdSchema = z.object({ presetId: z.string().min(1) });

export class BarberAvailabilityController {
  constructor(private readonly availabilityService: BarberAvailabilityService) {}

  private getBarberId(req: Request): string {
    const user = req.user!;
    if (user.role === 'BARBER') {
      return user.sub;
    }
    if (user.role === 'VENDOR_BARBER') {
      if (!user.barberId) {
        throw new ForbiddenError('Barber profile not found in token.');
      }
      return user.barberId;
    }
    throw new ForbiddenError('Access denied.');
  }

  createPreset = async (req: Request, res: Response): Promise<void> => {
    const input = createPresetSchema.parse(req.body);
    const result = await this.availabilityService.createPreset(this.getBarberId(req), input);
    res.status(201).json({ success: true, data: result });
  };

  listPresets = async (req: Request, res: Response): Promise<void> => {
    const result = await this.availabilityService.listPresets(this.getBarberId(req));
    res.status(200).json({ success: true, data: result });
  };

  deletePreset = async (req: Request, res: Response): Promise<void> => {
    const { presetId } = presetIdSchema.parse(req.params);
    await this.availabilityService.deletePreset(this.getBarberId(req), presetId);
    res.status(200).json({ success: true, data: null });
  };

  applyPreset = async (req: Request, res: Response): Promise<void> => {
    const { presetId } = presetIdSchema.parse(req.params);
    const result = await this.availabilityService.applyPreset(this.getBarberId(req), presetId);
    res.status(200).json({ success: true, data: result });
  };

  setAvailability = async (req: Request, res: Response): Promise<void> => {
    const input = setAvailabilitySchema.parse(req.body);
    const result = await this.availabilityService.setTodayAvailability(
      this.getBarberId(req),
      input,
    );
    res.status(200).json({ success: true, data: result });
  };

  getAvailability = async (req: Request, res: Response): Promise<void> => {
    const result = await this.availabilityService.getTodayAvailability(this.getBarberId(req));
    res.status(200).json({ success: true, data: result });
  };

  getDefault = async (req: Request, res: Response): Promise<void> => {
    const result = await this.availabilityService.getTodayDefault(this.getBarberId(req));
    res.status(200).json({ success: true, data: result });
  };
}
