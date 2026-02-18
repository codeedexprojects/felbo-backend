import jwt, { Secret } from 'jsonwebtoken';
import { UnauthorizedError } from '../errors/index';

export interface TokenPayload {
  userId: string;
  phone: string;
  role: 'USER' | 'VENDOR' | 'ADMIN' | 'SUPER_ADMIN' | 'SUB_ADMIN' | 'ASSOCIATION_ADMIN';
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export class JwtService {
  private readonly secret: Secret;
  private readonly expirySeconds: number;

  constructor(secret: string, expirySeconds: number = 30 * 24 * 60 * 60) {
    if (!secret) {
      throw new Error('JWT_SECRET is required for JwtService');
    }
    this.secret = secret;
    this.expirySeconds = expirySeconds;
  }

  signToken(payload: TokenPayload): string {
    return jwt.sign(payload as object, this.secret, {
      expiresIn: this.expirySeconds,
    });
  }

  verifyToken(token: string): DecodedToken {
    try {
      return jwt.verify(token, this.secret) as DecodedToken;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Session expired. Please login again.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token. Please login again.');
      }
      throw new UnauthorizedError('Authentication failed.');
    }
  }
}
