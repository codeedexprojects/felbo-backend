import { Logger } from 'winston';
import UserRepository from './user.repository';
import { UserDto, UserProfileDto, UpdateProfileInput } from './user.types';
import { IUser } from './user.model';
import { NotFoundError, ForbiddenError, AppError } from '../../shared/errors/index';

export default class UserService {
  constructor(
    private readonly userRepository: UserRepository,
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

  async findByPhone(phone: string): Promise<UserDto | null> {
    const user = await this.userRepository.findByPhone(phone);

    if (!user) return null;

    if (user.status === 'BLOCKED') {
      throw new ForbiddenError('Your account has been suspended. Contact support.');
    }

    if (user.status === 'DELETED') {
      throw new ForbiddenError('This account no longer exists.');
    }

    return this.toUserDto(user);
  }

  async createByPhone(phone: string): Promise<UserDto> {
    const newUser = await this.userRepository.create({ phone });

    this.logger.info('New user registered', {
      userId: newUser._id.toString(),
      phone: phone.slice(-4),
    });

    return this.toUserDto(newUser);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.updateLastLogin(userId);
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
