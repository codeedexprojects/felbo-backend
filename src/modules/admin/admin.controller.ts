import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { adminLoginSchema, listVendorsSchema, rejectVendorSchema } from './admin.validators';
import { AdminLoginInput } from './admin.types';
import { logger } from '../../shared/logger/logger';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = adminLoginSchema.parse(req.body);
      const input: AdminLoginInput = validated;

      logger.info('Admin login attempt', { email: input.email });

      const result = await this.adminService.login(input);

      logger.info('Admin login successful', {
        email: input.email,
        adminId: result.admin.id,
        role: result.admin.role,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listVendors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = listVendorsSchema.parse(req.query);

      const result = await this.adminService.listVendors({
        page: validated.page,
        limit: validated.limit,
        status: validated.status,
        verificationStatus: validated.verificationStatus,
        search: validated.search,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listVerificationRequests = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validated = listVendorsSchema.parse(req.query);

      const result = await this.adminService.listVerificationRequests(
        validated.page as number,
        validated.limit as number,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;

      await this.adminService.verifyVendor(id as string, adminId);

      res.status(200).json({
        success: true,
        message: 'Vendor approved successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  rejectVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;
      const validated = rejectVendorSchema.parse(req.body);

      await this.adminService.rejectVendor(id as string, adminId, validated.reason);

      res.status(200).json({
        success: true,
        message: 'Vendor rejected successfully.',
      });
    } catch (error) {
      next(error);
    }
  };
}
