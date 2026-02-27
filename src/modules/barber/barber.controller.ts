import { Request, Response } from 'express';
import { BarberService } from './barber.service';
import {
  createBarberSchema,
  updateBarberSchema,
  barberIdParamSchema,
  shopIdParamSchema,
  updateCredentialsSchema,
  listBarberQuerySchema,
  onboardBarberSchema,
  assignServicesSchema,
  barberServiceParamSchema,
} from './barber.validators';

export class BarberController {
  constructor(private readonly barberService: BarberService) {}

  listBarbers = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const filter = listBarberQuerySchema.parse(req.query);
    const result = await this.barberService.listBarbers(shopId, req.user!.sub, filter);
    res.status(200).json({ success: true, data: result });
  };

  createBarber = async (req: Request, res: Response): Promise<void> => {
    const validated = createBarberSchema.parse(req.body);
    const barber = await this.barberService.createBarber(validated, req.user!.sub);
    res.status(201).json({ success: true, data: barber });
  };

  getBarber = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const barber = await this.barberService.getBarber(barberId, req.user!.sub);
    res.status(200).json({ success: true, data: barber });
  };

  updateBarber = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const validated = updateBarberSchema.parse(req.body);
    const barber = await this.barberService.updateBarber(barberId, validated, req.user!.sub);
    res.status(200).json({ success: true, data: barber });
  };

  deleteBarber = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    await this.barberService.deleteBarber(barberId, req.user!.sub);
    res.status(200).json({ success: true, message: 'Barber deleted successfully.' });
  };

  toggleBarberAvailability = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const barber = await this.barberService.toggleBarberAvailability(barberId, req.user!.sub);
    res.status(200).json({ success: true, data: barber });
  };

  updateCredentials = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const validated = updateCredentialsSchema.parse(req.body);
    await this.barberService.updateCredentials(barberId, validated, req.user!.sub);
    res.status(200).json({ success: true, message: 'Credentials updated successfully.' });
  };

  addBarber = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const validated = onboardBarberSchema.parse(req.body);
    const result = await this.barberService.addBarber(shopId, req.user!.sub, validated);
    res.status(201).json({ success: true, data: result });
  };

  assignServices = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const validated = assignServicesSchema.parse(req.body);
    const result = await this.barberService.assignServices(barberId, req.user!.sub, validated);
    res.status(200).json({ success: true, data: result });
  };

  getBarberServices = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const result = await this.barberService.getBarberServices(barberId, req.user!.sub);
    res.status(200).json({ success: true, data: result });
  };

  removeBarberService = async (req: Request, res: Response): Promise<void> => {
    const { barberId, serviceId } = barberServiceParamSchema.parse(req.params);
    await this.barberService.removeBarberService(barberId, serviceId, req.user!.sub);
    res.status(200).json({ success: true, data: null });
  };
}
