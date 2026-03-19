import { Logger } from 'winston';
import { ClientSession } from '../../shared/database/transaction';
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
  ListUsersFilter,
  ListUsersResponse,
  UserListItemDto,
  UserDetailDto,
} from './user.types';
import { IUser } from './user.model';
import { BookingService } from '../booking/booking.service';
import { UserBookingsResponse } from '../booking/booking.types';
import { IssueService } from '../issue/issue.service';
import { FavoriteService } from '../favorite/favorite.service';
import {
  NotFoundError,
  ForbiddenError,
  AppError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
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
    private readonly getIssueService?: () => IssueService,
    private readonly getBookingService?: () => BookingService,
    private readonly getFavoriteService?: () => FavoriteService,
  ) {}

  private toUserDto(user: IUser): UserDto {
    return {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      email: user.email || null,
      profileUrl: user.profileUrl || null,
      gender: user.gender || null,
      felboCoinBalance: user.felboCoinBalance,
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
      profileUrl: user.profileUrl || null,
      gender: user.gender || null,
      felboCoinBalance: user.felboCoinBalance,
    };
  }

  private toVerifyOtpUserDto(user: IUser): VerifyOtpResponse['user'] {
    return {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      email: user.email || null,
      profileUrl: user.profileUrl || null,
      gender: user.gender || null,
      felboCoinBalance: user.felboCoinBalance,
    };
  }

  async sendOtp(input: SendOtpInput): Promise<SendOtpResponse> {
    const phoneWithCode = `91${input.phone}`;
    const result = await this.otpService.sendOtp(phoneWithCode, 'USER');

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

    if (input.fcmToken) {
      void this.userRepository.addFcmToken(user._id.toString(), input.fcmToken);
    }

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

  async registerFcmToken(userId: string, token: string): Promise<void> {
    if (!token) {
      throw new ValidationError('Token is required');
    }
    await this.userRepository.addFcmToken(userId, token);
  }

  async unregisterFcmToken(userId: string, token: string): Promise<void> {
    await this.userRepository.removeFcmToken(userId, token);
  }

  async incrementCancellationCount(userId: string, session?: ClientSession): Promise<void> {
    await this.userRepository.incrementCancellationCount(userId, session);
  }

  async getUserStatusCounts(): Promise<{ total: number; active: number; blocked: number }> {
    return this.userRepository.getStatusCounts();
  }

  async findAllUsers(filter: {
    search?: string;
    status?: 'ACTIVE' | 'BLOCKED';
    page: number;
    limit: number;
  }): Promise<{ users: IUser[]; total: number }> {
    return this.userRepository.findAll(filter);
  }

  async findUserForAdmin(userId: string): Promise<IUser> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found.');
    return user;
  }

  async blockUser(userId: string, reason: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found.');
    if (user.status === 'BLOCKED') throw new ConflictError('User is already blocked.');
    await this.userRepository.blockById(userId, reason);
  }

  async unblockUser(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found.');
    if (user.status !== 'BLOCKED') throw new ConflictError('User is not blocked.');
    await this.userRepository.unblockById(userId);
  }

  async listUsersForAdmin(filter: ListUsersFilter): Promise<ListUsersResponse> {
    const [{ users, total }, counts] = await Promise.all([
      this.userRepository.findAll(filter),
      this.userRepository.getStatusCounts(),
    ]);

    const mappedUsers: UserListItemDto[] = users.map((u, i) => ({
      slNo: total - (filter.page - 1) * filter.limit - i,
      id: u._id.toString(),
      name: u.name,
      phone: u.phone,
      email: u.email ?? null,
      status: u.status,
      felboCoinBalance: u.felboCoinBalance,
      cancellationCount: u.cancellationCount,
      lastLoginAt: u.lastLoginAt ?? null,
      registeredAt: u.createdAt,
    }));

    return {
      users: mappedUsers,
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
      counts,
    };
  }

  async getUserDetailForAdmin(userId: string): Promise<UserDetailDto> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found.');

    const issuesReported = this.getIssueService
      ? await this.getIssueService().getRecentIssuesByUserId(userId)
      : [];

    const favoritesResponse = this.getFavoriteService
      ? await this.getFavoriteService().listFavorites(userId, 1, 10)
      : { favorites: [] };

    const bookingsResponse = this.getBookingService
      ? await this.getBookingService().getUserBookings(userId, 1, 10)
      : { bookings: [] };

    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email ?? null,
      profileUrl: user.profileUrl ?? null,
      status: user.status,
      blockReason: user.blockReason ?? null,
      felboCoinBalance: user.felboCoinBalance,
      cancellationCount: user.cancellationCount,
      registeredAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      issuesReported,
      issueCount: issuesReported.length,
      recentBookings: bookingsResponse.bookings,
      favorites: favoritesResponse.favorites.map((f) => ({
        shopId: f.shopId,
        name: f.name,
        image: f.image,
        rating: f.rating.average,
      })),
    };
  }

  async getAdminUserBookings(
    userId: string,
    page: number,
    limit: number,
  ): Promise<UserBookingsResponse> {
    if (!this.getBookingService) throw new Error('BookingService not injected');

    const user = await this.userRepository.findById(userId);
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found.');

    return this.getBookingService().getUserBookings(userId, page, limit);
  }
}
