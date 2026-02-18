import bcrypt from 'bcryptjs';
import { Logger } from 'winston';
import { AdminRepository } from './admin.repository';
import { AdminLoginInput, AdminLoginResponse, AdminDTO } from './admin.types';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';
import { UnauthorizedError } from '../../shared/errors/index';
import { IAdmin } from './admin.model';

export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  async login(input: AdminLoginInput): Promise<AdminLoginResponse> {
    const { email, password } = input;

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

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

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
      role: 'ADMIN',
    };

    const token = this.jwtService.signToken(tokenPayload);

    this.logger.info('Admin logged in successfully', {
      adminId: admin._id,
      email: admin.email,
      role: admin.role,
    });

    return {
      token,
      admin: this.mapToDTO(admin),
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
