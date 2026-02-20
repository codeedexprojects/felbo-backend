import { Logger } from 'winston';
import { AdminRepository } from './admin.repository';
import { AdminLoginInput, AdminLoginResponse, AdminDTO } from './admin.types';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';
import { UnauthorizedError } from '../../shared/errors/index';
import { IAdmin } from './admin.model';
import VendorService from '../vendor/vendor.service';
import { ListVendorsFilter, ListVendorsResponse } from '../vendor/vendor.types';
import { comparePassword } from '../../shared/utils/password';

export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly jwtService: JwtService,
    private readonly vendorService: VendorService,
    private readonly logger: Logger,
  ) {}

  async listVendors(filter: ListVendorsFilter): Promise<ListVendorsResponse> {
    return this.vendorService.listVendors(filter);
  }

  async listVerificationRequests(page: number, limit: number): Promise<ListVendorsResponse> {
    return this.vendorService.listVendors({
      page,
      limit,
      verificationStatus: 'PENDING',
    });
  }

  async verifyVendor(vendorId: string, adminId: string): Promise<void> {
    await this.vendorService.approveVendor(vendorId, adminId);
  }

  async rejectVendor(vendorId: string, adminId: string, reason: string): Promise<void> {
    await this.vendorService.rejectVendor(vendorId, adminId, reason);
  }

  async login(input: AdminLoginInput): Promise<AdminLoginResponse> {
    const { email, password } = input;

    this.logger.info('Admin login attempt', { email });

    const admin = await this.adminRepository.findByEmail(email);

    if (!admin) {
      this.logger.warn('Admin login failed: email not found', { email });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (admin.status === 'INACTIVE') {
      this.logger.warn('Admin login failed: account inactive', {
        adminId: admin._id,
        email,
      });
      throw new UnauthorizedError('Account is inactive. Contact super admin.');
    }

    const isPasswordValid = await comparePassword(password, admin.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn('Admin login failed: invalid password', {
        adminId: admin._id,
        email,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.adminRepository.updateLastLogin(admin._id.toString());

    const tokenPayload: TokenPayload = {
      userId: admin._id.toString(),
      phone: admin.phone,
      role: admin.role,
    };

    const token = this.jwtService.signToken(tokenPayload);
    const refreshToken = this.jwtService.signRefreshToken(tokenPayload);

    const refreshTokenHash = this.jwtService.hashToken(refreshToken);
    await this.adminRepository.updateRefreshToken(admin._id.toString(), refreshTokenHash);

    this.logger.info('Admin logged in successfully', {
      adminId: admin._id,
      email: admin.email,
      role: admin.role,
    });

    return {
      token,
      refreshToken,
      admin: this.mapToDTO(admin),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<AdminLoginResponse> {
    const decoded = this.jwtService.verifyRefreshToken(refreshToken);

    const admin = await this.adminRepository.findByIdWithRefreshToken(decoded.userId);

    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    if (!admin.refreshTokenHash) {
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    const isValid = this.jwtService.compareTokenHash(refreshToken, admin.refreshTokenHash);

    if (!isValid) {
      await this.adminRepository.updateRefreshToken(admin._id.toString(), null);
      this.logger.warn('Refresh token reuse detected — cleared stored token', {
        adminId: admin._id,
      });
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    const tokenPayload: TokenPayload = {
      userId: admin._id.toString(),
      phone: admin.phone,
      role: admin.role,
    };

    const newToken = this.jwtService.signToken(tokenPayload);
    const newRefreshToken = this.jwtService.signRefreshToken(tokenPayload);

    const newRefreshTokenHash = this.jwtService.hashToken(newRefreshToken);
    await this.adminRepository.updateRefreshToken(admin._id.toString(), newRefreshTokenHash);

    return {
      token: newToken,
      refreshToken: newRefreshToken,
      admin: this.mapToDTO(admin),
    };
  }

  async logout(adminId: string): Promise<void> {
    await this.adminRepository.updateRefreshToken(adminId, null);
    this.logger.info('Admin logged out', { adminId });
  }

  private mapToDTO(admin: IAdmin): AdminDTO {
    return {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      status: admin.status,
      createdBy: admin.createdBy?.toString(),
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
