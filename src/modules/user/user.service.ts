import { Logger } from 'winston';
import UserRepository from './user.repository';
import {
  UserDto,
  UserProfileDto,
  UpdateProfileInput,
  SendOtpInput,
  SendOtpResponse,
  VerifyOtpInput,
  VerifyOtpResponse,
  RefreshTokenResponse,
} from './user.types';
import { IUser } from './user.model';
import {
  NotFoundError,
  ForbiddenError,
  AppError,
  UnauthorizedError,
} from '../../shared/errors/index';
import { OtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';

function last4(phone: string): string {
  return phone.slice(-4);
}

export default class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpService: OtpService,
    private readonly otpSessionService: OtpSessionService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  private toUserDto(user: IUser): UserDto {
    return {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      email: user.email || null,
      walletBalance: user.walletBalance,
      cancellationCount: user.cancellationCount,
      status: user.status,
      lastLoginAt: user.lastLoginAt || null,
      createdAt: user.createdAt,
    };
  }

  private toProfileDto(user: IUser): UserProfileDto {
    return {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      email: user.email || null,
      walletBalance: user.walletBalance,
    };
  }

  private toVerifyOtpUserDto(user: IUser): VerifyOtpResponse['user'] {
    return {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      email: user.email || null,
      walletBalance: user.walletBalance,
    };
  }

  async sendOtp(input: SendOtpInput): Promise<SendOtpResponse> {
    const phoneWithCode = `91${input.phone}`;
    const result = await this.otpService.sendOtp(phoneWithCode);

    await this.otpSessionService.storeSession(result.sessionId, input.phone);

    this.logger.info({
      action: 'USER_OTP_SENT',
      module: 'user',
      phone: last4(input.phone),
    });

    return {
      sessionId: result.sessionId,
      message: 'OTP sent successfully',
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResponse> {
    await this.otpSessionService.verifySessionPhone(input.sessionId, input.phone);

    const otpResult = await this.otpService.verifyOtp(input.sessionId, input.otp);

    if (!otpResult.verified) {
      throw new UnauthorizedError('Invalid OTP. Please try again.');
    }

    await this.otpSessionService.deleteSession(input.sessionId);

    let user = await this.userRepository.findByPhone(input.phone);
    let isNewUser = false;

    if (user) {
      if (user.status === 'BLOCKED') {
        throw new ForbiddenError('Your account has been suspended. Contact support.');
      }
      if (user.status === 'DELETED') {
        throw new ForbiddenError('This account no longer exists.');
      }
    } else {
      user = await this.userRepository.create({ phone: input.phone });
      isNewUser = true;
    }

    await this.userRepository.updateLastLogin(user._id.toString());

    const tokenPayload: TokenPayload = {
      sub: user._id.toString(),
      role: 'USER',
    };

    const token = this.jwtService.signToken(tokenPayload);
    const refreshToken = this.jwtService.signRefreshToken(tokenPayload);

    const refreshTokenHash = this.jwtService.hashToken(refreshToken);
    await this.userRepository.updateRefreshToken(user._id.toString(), refreshTokenHash);

    this.logger.info({
      action: 'USER_AUTHENTICATED',
      module: 'user',
      userId: user._id.toString(),
      phone: last4(input.phone),
      isNewUser,
    });

    return {
      token,
      refreshToken,
      isNewUser,
      user: this.toVerifyOtpUserDto(user),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const decoded = this.jwtService.verifyRefreshToken(refreshToken);

    const user = await this.userRepository.findByIdWithRefreshToken(decoded.sub);

    if (!user || user.status === 'BLOCKED' || user.status === 'DELETED') {
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    const isValid = this.jwtService.compareTokenHash(refreshToken, user.refreshTokenHash);

    if (!isValid) {
      await this.userRepository.updateRefreshToken(user._id.toString(), null);
      this.logger.warn('Refresh token reuse detected — cleared stored token', {
        userId: user._id,
      });
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    const tokenPayload: TokenPayload = {
      sub: user._id.toString(),
      role: 'USER',
    };

    const newToken = this.jwtService.signToken(tokenPayload);
    const newRefreshToken = this.jwtService.signRefreshToken(tokenPayload);

    const newRefreshTokenHash = this.jwtService.hashToken(newRefreshToken);
    await this.userRepository.updateRefreshToken(user._id.toString(), newRefreshTokenHash);

    return { token: newToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.updateRefreshToken(userId, null);
    this.logger.info('User logged out', { userId });
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.toProfileDto(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfileDto> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updated = await this.userRepository.updateProfile(userId, input);

    if (!updated) {
      throw new AppError('Failed to update profile', 500);
    }

    this.logger.info('User profile updated', { userId });

    return this.toProfileDto(updated);
  }

  async getUserById(userId: string): Promise<UserDto> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.toUserDto(user);
  }
}
