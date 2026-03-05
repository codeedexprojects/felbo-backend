import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/index';

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required. Please login.');
    }

    const userRole = req.user.role;
    let hasAccess = roles.includes(userRole);

    // VENDOR_BARBER can access both VENDOR and BARBER protected routes
    if (!hasAccess && userRole === 'VENDOR_BARBER') {
      hasAccess = roles.includes('VENDOR') || roles.includes('BARBER');
    }

    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to access this resource.');
    }

    next();
  };
}
