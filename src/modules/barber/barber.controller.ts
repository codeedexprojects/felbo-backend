import { Request, Response } from 'express';
import { BarberService } from './barber.service';
import { ForbiddenError } from '../../shared/errors/index';
import {
  createBarberSchema,
  updateBarberSchema,
  barberIdParamSchema,
  shopIdParamSchema,
  updateCredentialsSchema,
  listBarberQuerySchema,
  onboardBarberSchema,
  addBarberServicesSchema,
  barberShopParamSchema,
  barberSendOtpSchema,
  barberVerifyOtpSchema,
  barberSetPasswordSchema,
  barberLoginSchema,
  barberRefreshTokenSchema,
  addSelfAsBarberSchema,
  createSlotBlockSchema,
  releaseSlotBlockParamSchema,
  listSlotBlocksQuerySchema,
} from './barber.validators';

export class BarberController {
  constructor(private readonly barberService: BarberService) {}

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

  addBarberServices = async (req: Request, res: Response): Promise<void> => {
    const { shopId, barberId } = barberShopParamSchema.parse(req.params);
    const validated = addBarberServicesSchema.parse(req.body);
    const result = await this.barberService.addBarberServices(
      shopId,
      barberId,
      req.user!.sub,
      validated,
    );
    res.status(201).json({ success: true, data: result });
  };

  sendOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = barberSendOtpSchema.parse(req.body);
    const result = await this.barberService.sendOtp({
      email: validated.email,
      clientIp: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    });
    res.status(200).json({ success: true, data: result });
  };

  verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = barberVerifyOtpSchema.parse(req.body);
    const result = await this.barberService.verifyOtp(validated);
    res.status(200).json({ success: true, data: result });
  };

  setPassword = async (req: Request, res: Response): Promise<void> => {
    const validated = barberSetPasswordSchema.parse(req.body);
    const result = await this.barberService.setPassword(validated);
    res.status(200).json({ success: true, data: result });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const validated = barberLoginSchema.parse(req.body);
    const result = await this.barberService.login(validated);
    res.status(200).json({ success: true, data: result });
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = barberRefreshTokenSchema.parse(req.body);
    const result = await this.barberService.refreshAccessToken(refreshToken);
    res.status(200).json({ success: true, data: result });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.barberService.logout(req.user!.sub);
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  };

  addSelfAsBarber = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const validated = addSelfAsBarberSchema.parse(req.body);
    const result = await this.barberService.addSelfAsBarber(shopId, req.user!.sub, validated);
    res.status(201).json({
      success: true,
      data: result,
      message: 'You have been added as a barber.',
    });
  };

  createSlotBlock = async (req: Request, res: Response): Promise<void> => {
    const validated = createSlotBlockSchema.parse(req.body);
    const result = await this.barberService.createSlotBlock({
      barberId: this.getBarberId(req),
      serviceIds: validated.serviceIds,
      reason: validated.reason,
    });
    res.status(201).json({
      success: true,
      data: result,
      message: 'Slot blocked successfully',
    });
  };

  releaseSlotBlock = async (req: Request, res: Response): Promise<void> => {
    const { blockId } = releaseSlotBlockParamSchema.parse(req.params);
    const result = await this.barberService.releaseSlotBlock({
      blockId,
      barberId: this.getBarberId(req),
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Slot block released successfully',
    });
  };

  listSlotBlocks = async (req: Request, res: Response): Promise<void> => {
    const validated = listSlotBlocksQuerySchema.parse(req.query);
    const result = await this.barberService.listSlotBlocks(this.getBarberId(req), validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
