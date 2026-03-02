import { Request, Response } from 'express';
import { ServiceService } from './service.service';
import {
  shopIdOnboardingParamSchema,
  addServiceSchema,
  updateServiceSchema,
  serviceIdParamSchema,
  assignServicesSchema,
  barberServiceParamSchema,
  barberIdParamSchema,
} from './service.validators';

export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  addService = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const validated = addServiceSchema.parse(req.body);
    const result = await this.serviceService.addService(shopId, req.user!.sub, validated);

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  createService = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const validated = addServiceSchema.parse(req.body);
    const result = await this.serviceService.createService(shopId, req.user!.sub, validated);

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  listServices = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdOnboardingParamSchema.parse(req.params);
    const result = await this.serviceService.listServices(shopId, req.user!.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateService = async (req: Request, res: Response): Promise<void> => {
    const { shopId, serviceId } = serviceIdParamSchema.parse(req.params);
    const validated = updateServiceSchema.parse(req.body);
    const result = await this.serviceService.updateService(
      shopId,
      req.user!.sub,
      serviceId,
      validated,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  deleteService = async (req: Request, res: Response): Promise<void> => {
    const { shopId, serviceId } = serviceIdParamSchema.parse(req.params);
    await this.serviceService.deleteService(shopId, req.user!.sub, serviceId);

    res.status(200).json({
      success: true,
      data: null,
    });
  };

  toggleService = async (req: Request, res: Response): Promise<void> => {
    const { shopId, serviceId } = serviceIdParamSchema.parse(req.params);
    const result = await this.serviceService.toggleService(shopId, req.user!.sub, serviceId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  assignServices = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const validated = assignServicesSchema.parse(req.body);
    const result = await this.serviceService.assignServices(barberId, req.user!.sub, validated);
    res.status(200).json({ success: true, data: result });
  };

  getBarberServices = async (req: Request, res: Response): Promise<void> => {
    const { barberId } = barberIdParamSchema.parse(req.params);
    const result = await this.serviceService.getBarberServices(barberId, req.user!.sub);
    res.status(200).json({ success: true, data: result });
  };

  removeBarberService = async (req: Request, res: Response): Promise<void> => {
    const { barberId, serviceId } = barberServiceParamSchema.parse(req.params);
    await this.serviceService.removeBarberService(barberId, serviceId, req.user!.sub);
    res.status(200).json({ success: true, data: null });
  };
}
