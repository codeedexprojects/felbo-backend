import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import { config } from '../config/config.service';
import { UnauthorizedError } from '../errors/index';

const jwtService = new JwtService(config.jwt.secret, config.jwt.expirySeconds);

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication required. Please login.');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError('Authentication required. Please login.');
  }

  const decoded = jwtService.verifyToken(token);

  req.user = decoded;
  next();
}
