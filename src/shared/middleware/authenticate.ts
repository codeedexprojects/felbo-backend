import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import { config } from '../config/config.service';
import { UnauthorizedError } from '../errors/index';
import { getRedisClient } from '../redis/redis';

const jwtService = new JwtService(config.jwt.secret, config.jwt.expirySeconds);

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication required. Please login.');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError('Authentication required. Please login.');
  }

  const decoded = jwtService.verifyToken(token);

  const role = decoded.role;

  if (role === 'USER') {
    const [isBlocked, isDeleted] = await Promise.all([
      getRedisClient().get(`user:blocked:${decoded.sub}`),
      getRedisClient().get(`user:deleted:${decoded.sub}`),
    ]);
    if (isDeleted) {
      throw new UnauthorizedError('This account has been deactivated.');
    }
    if (isBlocked) {
      throw new UnauthorizedError('Your account has been suspended. Please contact support.');
    }
  } else if (role === 'VENDOR' || role === 'VENDOR_BARBER') {
    const [isDeleted, isBlocked] = await Promise.all([
      getRedisClient().get(`vendor:deleted:${decoded.sub}`),
      getRedisClient().get(`vendor:blocked:${decoded.sub}`),
    ]);
    if (isDeleted) {
      throw new UnauthorizedError('This account has been deactivated.');
    }
    if (isBlocked) {
      throw new UnauthorizedError('Your account has been suspended. Please contact support.');
    }
  }

  req.user = decoded;
  next();
}
