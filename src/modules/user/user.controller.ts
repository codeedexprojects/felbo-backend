import { Request, Response } from 'express';
import UserService from './user.service';
import {
  sendOtpSchema,
  verifyOtpSchema,
  updateProfileSchema,
  refreshTokenSchema,
  fcmTokenSchema,
  listUsersSchema,
  blockUserSchema,
  userIdParamSchema,
  userBookingsPaginationSchema,
} from './user.validators';

export default class UserController {
  constructor(private readonly userService: UserService) {}

  sendOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = sendOtpSchema.parse(req.body);
    const result = await this.userService.sendOtp(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = verifyOtpSchema.parse(req.body);
    const result = await this.userService.verifyOtp(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    const result = await this.userService.getProfile(req.user!.sub);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const validated = updateProfileSchema.parse(req.body);
    const result = await this.userService.updateProfile(req.user!.sub, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const result = await this.userService.refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.userService.logout(req.user!.sub);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  };

  deactivateAccount = async (req: Request, res: Response): Promise<void> => {
    await this.userService.deactivateAccount(req.user!.sub);
    res.status(200).json({ success: true, message: 'Account deactivated successfully.' });
  };

  registerFcmToken = async (req: Request, res: Response): Promise<void> => {
    const { token } = fcmTokenSchema.parse(req.body);
    await this.userService.registerFcmToken(req.user!.sub, token);

    res.status(200).json({
      success: true,
      message: 'Token registered',
    });
  };

  unregisterFcmToken = async (req: Request, res: Response): Promise<void> => {
    const { token } = fcmTokenSchema.parse(req.body);
    await this.userService.unregisterFcmToken(req.user!.sub, token);

    res.status(200).json({
      success: true,
      message: 'Token removed',
    });
  };

  // ─── Admin handlers ────────────────────────────────────────────────────────

  adminListUsers = async (req: Request, res: Response): Promise<void> => {
    const filter = listUsersSchema.parse(req.query);
    const result = await this.userService.listUsersForAdmin(filter);
    res.status(200).json({ success: true, data: result });
  };

  adminGetUserDetail = async (req: Request, res: Response): Promise<void> => {
    const { id } = userIdParamSchema.parse(req.params);
    const result = await this.userService.getUserDetailForAdmin(id);
    res.status(200).json({ success: true, data: result });
  };

  adminBlockUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = userIdParamSchema.parse(req.params);
    const { reason } = blockUserSchema.parse(req.body);
    await this.userService.blockUser(id, reason);
    res.status(200).json({ success: true, message: 'User blocked successfully.' });
  };

  adminUnblockUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = userIdParamSchema.parse(req.params);
    await this.userService.unblockUser(id);
    res.status(200).json({ success: true, message: 'User unblocked successfully.' });
  };

  adminGetUserBookings = async (req: Request, res: Response): Promise<void> => {
    const { id } = userIdParamSchema.parse(req.params);
    const { page, limit } = userBookingsPaginationSchema.parse(req.query);
    const result = await this.userService.getAdminUserBookings(id, page, limit);
    res.status(200).json({ success: true, data: result });
  };
}
