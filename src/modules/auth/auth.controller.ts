import { Request, Response } from 'express';
import AuthService from './auth.service';
import { sendOtpSchema, verifyOtpSchema } from './auth.validators';

export default class AuthController {
  constructor(private readonly authService: AuthService) {}

  sendOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = sendOtpSchema.parse(req.body);
    const result = await this.authService.sendOtp(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const validated = verifyOtpSchema.parse(req.body);
    const result = await this.authService.verifyOtp(validated);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
