import { Logger } from 'winston';
import { OtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';
import UserService from '../user/user.service';
import { SendOtpInput, VerifyOtpInput, SendOtpResponse, VerifyOtpResponse } from './auth.types';
import { UnauthorizedError } from '../../shared/errors/index';

export default class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly otpSessionService: OtpSessionService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  async sendOtp(input: SendOtpInput): Promise<SendOtpResponse> {
    const { phone } = input;

    const phoneWithCode = `91${phone}`;
    const result = await this.otpService.sendOtp(phoneWithCode);

    await this.otpSessionService.storeSession(result.sessionId, phone);

    return {
      sessionId: result.sessionId,
      message: 'OTP sent successfully',
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResponse> {
    const { phone, otp, sessionId } = input;

    // Verify that this session was created for this phone number
    await this.otpSessionService.verifySessionPhone(sessionId, phone);

    const otpResult = await this.otpService.verifyOtp(sessionId, otp);

    if (!otpResult.verified) {
      throw new UnauthorizedError('Invalid OTP. Please try again.');
    }

    // OTP verified — clean up session
    await this.otpSessionService.deleteSession(sessionId);

    let isNewUser = false;
    let user = await this.userService.findByPhone(phone);

    if (!user) {
      user = await this.userService.createByPhone(phone);
      isNewUser = true;
    }

    await this.userService.updateLastLogin(user.id);

    const tokenPayload: TokenPayload = {
      userId: user.id,
      phone: user.phone,
      role: 'USER',
    };

    const token = this.jwtService.signToken(tokenPayload);

    this.logger.info('User authenticated', {
      userId: user.id,
      phone: phone.slice(-4),
      isNewUser,
    });

    return {
      token,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
      },
    };
  }
}
