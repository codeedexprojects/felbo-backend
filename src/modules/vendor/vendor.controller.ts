import { Request, Response } from 'express';
import VendorService from './vendor.service';
import {
  sendOtpSchema,
  loginVerifyOtpSchema,
  registerVerifyOtpSchema,
  registerAssociationSchema,
  registerIndependentInitiateSchema,
  registerIndependentConfirmSchema,
  refreshTokenSchema,
} from './vendor.validators';

export default class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  sendOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = sendOtpSchema.parse(req.body);
    const result = await this.vendorService.sendOtp(validated.phone);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  loginVerifyOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = loginVerifyOtpSchema.parse(req.body);
    const result = await this.vendorService.loginVerifyOtp(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  registerVerifyOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = registerVerifyOtpSchema.parse(req.body);
    const result = await this.vendorService.registerVerifyOtp(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  registerAssociation = async (req: Request, res: Response): Promise<void> => {
    const validated = registerAssociationSchema.parse(req.body);
    const result = await this.vendorService.registerAssociation(validated);

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  registerIndependentInitiate = async (req: Request, res: Response): Promise<void> => {
    const validated = registerIndependentInitiateSchema.parse(req.body);
    const result = await this.vendorService.registerIndependentInitiate(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  registerIndependentConfirm = async (req: Request, res: Response): Promise<void> => {
    const validated = registerIndependentConfirmSchema.parse(req.body);
    const result = await this.vendorService.registerIndependentConfirm(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getRegistrationStatus = async (req: Request, res: Response): Promise<void> => {
    const result = await this.vendorService.getRegistrationStatus(req.user!.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    const result = await this.vendorService.getProfile(req.user!.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const result = await this.vendorService.refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.vendorService.logout(req.user!.sub);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  };
}
