import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { adminLoginSchema } from './admin.validators';
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
}
