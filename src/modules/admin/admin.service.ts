import { Logger } from 'winston';
import { AdminRepository } from './admin.repository';
import {
  AdminLoginInput,
  AdminLoginResponse,
  AdminDTO,
  ListUsersFilter,
  ListUsersResponse,
  UserDetailDto,
  UserListItemDto,
  UserIssueDto,
  SuperAdminDashboardDto,
  AssociationAdminDashboardDto,
} from './admin.types';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/index';
import { IAdmin } from './admin.model';
import { IUser } from '../user/user.model';
import UserService from '../user/user.service';
import VendorService from '../vendor/vendor.service';
import { IssueService } from '../issue/issue.service';
import { BookingService } from '../booking/booking.service';
import ShopService from '../shop/shop.service';
import {
  ListVendorsFilter,
  ListVendorsResponse,
  ListVerificationRequestsResponse,
  VendorAdminDetail,
  VendorRequestAdminDetail,
} from '../vendor/vendor.types';
import { comparePassword } from '../../shared/utils/password';

export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly jwtService: JwtService,
    private readonly vendorService: VendorService,
    private readonly userService: UserService,
    private readonly issueService: IssueService,
    private readonly logger: Logger,
    private readonly bookingService: BookingService,
    private readonly shopService: ShopService,
  ) {}

  async getSuperAdminDashboard(): Promise<SuperAdminDashboardDto> {
    const [userCounts, vendorStats, bookingStats, recentIssues] = await Promise.all([
      this.userService.getUserStatusCounts(),
      this.vendorService.getVendorDashboardStats(),
      this.bookingService.getGlobalDashboardStats(),
      this.issueService.getRecentIssuesForDashboard(5),
    ]);

    return {
      totalUsers: userCounts.total,
      totalVendors: vendorStats.total,
      totalBookings: bookingStats.totalBookings,
      todaysBookings: bookingStats.todaysBookings,
      todaysRevenue: bookingStats.todaysRevenue,
      pendingVerifications: vendorStats.pendingVerifications,
      recentIssues,
    };
  }

  async getAssociationAdminDashboard(): Promise<AssociationAdminDashboardDto> {
    const vendorIds = await this.vendorService.getAssociationVendorIds();

    const shopIds = await this.shopService.getShopIdsByVendorIds(vendorIds);

    const bookingStats = await this.bookingService.getStatsByShopIds(shopIds);

    return {
      myVendorsCount: vendorIds.length,
      myVendorsBookings: {
        today: bookingStats.todaysBookings,
        total: bookingStats.totalBookings,
      },
      myVendorsRevenue: bookingStats.totalBookings * 2,
    };
  }

  async getVendorRequestDetail(vendorId: string): Promise<VendorRequestAdminDetail> {
    return this.vendorService.getVendorRequestDetailForAdmin(vendorId);
  }

  async getVendorDetail(vendorId: string, callerRole: string): Promise<VendorAdminDetail> {
    const detail = await this.vendorService.getVendorDetailForAdmin(vendorId);

    if (callerRole === 'ASSOCIATION_ADMIN' && detail.registrationType !== 'ASSOCIATION') {
      throw new ForbiddenError('Access denied. You can only view association vendors.');
    }

    return detail;
  }

  async listVendors(filter: ListVendorsFilter, callerRole: string): Promise<ListVendorsResponse> {
    const effectiveFilter: ListVendorsFilter =
      callerRole === 'ASSOCIATION_ADMIN'
        ? { ...filter, registrationType: 'ASSOCIATION' }
        : { ...filter };

    return this.vendorService.listVendors(effectiveFilter);
  }

  async listVerificationRequests(
    page: number,
    limit: number,
    search?: string,
  ): Promise<ListVerificationRequestsResponse> {
    return this.vendorService.listVerificationRequests(page, limit, search);
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
      sub: admin._id.toString(),
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

    const admin = await this.adminRepository.findByIdWithRefreshToken(decoded.sub);

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
      sub: admin._id.toString(),
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

  async listUsers(filter: ListUsersFilter): Promise<ListUsersResponse> {
    const [{ users, total }, counts] = await Promise.all([
      this.userService.findAllUsers(filter),
      this.userService.getUserStatusCounts(),
    ]);

    return {
      users: users.map((u, i) =>
        this.mapUserToListItem(u, total - (filter.page - 1) * filter.limit - i),
      ),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
      counts,
    };
  }

  async getUserDetail(userId: string): Promise<UserDetailDto> {
    const user = await this.userService.findUserForAdmin(userId);

    const issuesReported: UserIssueDto[] = await this.issueService.getRecentIssuesByUserId(userId);

    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email ?? null,
      status: user.status,
      blockReason: user.blockReason ?? null,
      walletBalance: user.walletBalance,
      cancellationCount: user.cancellationCount,
      registeredAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      issuesReported,
      issueCount: issuesReported.length,
    };
  }

  async blockUser(userId: string, reason: string): Promise<void> {
    await this.userService.blockUser(userId, reason);
  }

  async unblockUser(userId: string): Promise<void> {
    await this.userService.unblockUser(userId);
  }

  private mapUserToListItem(user: IUser, slNo: number): UserListItemDto {
    return {
      slNo,
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email ?? null,
      status: user.status,
      walletBalance: user.walletBalance,
      cancellationCount: user.cancellationCount,
      lastLoginAt: user.lastLoginAt ?? null,
      registeredAt: user.createdAt,
    };
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
