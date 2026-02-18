import { Request, Response } from 'express';
import UserService from './user.service';
import { sendOtpSchema, verifyOtpSchema, updateProfileSchema } from './user.validators';

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
    const result = await this.userService.getProfile(req.user!.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const validated = updateProfileSchema.parse(req.body);
    const result = await this.userService.updateProfile(req.user!.userId, validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
