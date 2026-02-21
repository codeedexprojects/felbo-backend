import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import {
  adminLoginSchema,
  listVendorsSchema,
  rejectVendorSchema,
  vendorIdParamSchema,
} from './admin.validators';
import { AdminLoginInput } from './admin.types';
import { UnauthorizedError } from '../../shared/errors/index';
import { config } from '../../shared/config/config.service';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const validated = adminLoginSchema.parse(req.body);
    const input: AdminLoginInput = validated;

    const { token, refreshToken, admin } = await this.adminService.login(input);

    res.cookie(config.admin.cookie.name, refreshToken, config.admin.cookie.options);

    res.status(200).json({
      success: true,
      data: { token, admin },
    });
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const refreshToken: string | undefined = req.cookies[config.admin.cookie.name];
    if (!refreshToken) {
      throw new UnauthorizedError('No refresh token. Please login again.');
    }

    const {
      token,
      refreshToken: newRefreshToken,
      admin,
    } = await this.adminService.refreshAccessToken(refreshToken);

    res.cookie(config.admin.cookie.name, newRefreshToken, config.admin.cookie.options);

    res.status(200).json({
      success: true,
      data: { token, admin },
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const adminId = req.user!.userId;
    await this.adminService.logout(adminId);

    res.clearCookie(config.admin.cookie.name, { path: config.admin.cookie.options.path });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  };

  listVendors = async (req: Request, res: Response): Promise<void> => {
    const validated = listVendorsSchema.parse(req.query);
    const callerRole = req.user!.role;

    const result = await this.adminService.listVendors(
      {
        page: validated.page,
        limit: validated.limit,
        status: validated.status,
        verificationStatus: validated.verificationStatus,
        search: validated.search,
      },
      callerRole,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  listVerificationRequests = async (req: Request, res: Response): Promise<void> => {
    const validated = listVendorsSchema.parse(req.query);

    const result = await this.adminService.listVerificationRequests(
      validated.page,
      validated.limit,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  verifyVendor = async (req: Request, res: Response): Promise<void> => {
    const { id } = vendorIdParamSchema.parse(req.params);
    const adminId = req.user!.userId;

    await this.adminService.verifyVendor(id, adminId);

    res.status(200).json({
      success: true,
      message: 'Vendor approved successfully.',
    });
  };

  rejectVendor = async (req: Request, res: Response): Promise<void> => {
    const { id } = vendorIdParamSchema.parse(req.params);
    const adminId = req.user!.userId;
    const validated = rejectVendorSchema.parse(req.body);

    await this.adminService.rejectVendor(id, adminId, validated.reason);

    res.status(200).json({
      success: true,
      message: 'Vendor rejected successfully.',
    });
  };

  getVendorDetail = async (req: Request, res: Response): Promise<void> => {
    const { id } = vendorIdParamSchema.parse(req.params);
    const callerRole = req.user!.role;

    const result = await this.adminService.getVendorDetail(id, callerRole);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
