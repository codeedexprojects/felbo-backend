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
  fcmTokenSchema,
  updateProfileSchema,
  dashboardStatsQuerySchema,
  vendorBookingsQuerySchema,
  vendorBookingIdParamSchema,
  deactivateAccountSchema,
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

  getRegistrationPaymentSummary = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.vendorService.getRegistrationPaymentSummary();

    res.status(200).json({
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

  getOnboardingStatus = async (req: Request, res: Response): Promise<void> => {
    const result = await this.vendorService.getOnboardingStatus(req.user!.sub);

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

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const validated = updateProfileSchema.parse(req.body);
    const result = await this.vendorService.updateProfile(req.user!.sub, validated);

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

  deactivateAccount = async (req: Request, res: Response): Promise<void> => {
    const { reason } = deactivateAccountSchema.parse(req.body);
    await this.vendorService.deactivateAccount(req.user!.sub, reason);
    res.status(200).json({ success: true, message: 'Account deactivated successfully.' });
  };

  registerFcmToken = async (req: Request, res: Response): Promise<void> => {
    const { token } = fcmTokenSchema.parse(req.body);
    await this.vendorService.registerFcmToken(req.user!.sub, token);

    res.status(200).json({
      success: true,
      message: 'Token registered',
    });
  };

  unregisterFcmToken = async (req: Request, res: Response): Promise<void> => {
    const { token } = fcmTokenSchema.parse(req.body);
    await this.vendorService.unregisterFcmToken(req.user!.sub, token);

    res.status(200).json({
      success: true,
      message: 'Token removed',
    });
  };

  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = dashboardStatsQuerySchema.parse(req.query);
    const result = await this.vendorService.getDashboardCounts(req.user!.sub, shopId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getVendorBookings = async (req: Request, res: Response): Promise<void> => {
    const { shopId, status, page, limit, startDate, endDate } = vendorBookingsQuerySchema.parse(
      req.query,
    );
    const result = await this.vendorService.getVendorBookings(req.user!.sub, {
      shopId,
      status,
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getVendorBookingDetail = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = vendorBookingIdParamSchema.parse(req.params);
    const result = await this.vendorService.getVendorBookingDetail(req.user!.sub, bookingId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
