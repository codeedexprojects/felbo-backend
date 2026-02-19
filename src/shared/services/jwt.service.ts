import crypto from 'crypto';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
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
  private readonly refreshSecret: Secret;
  private readonly expirySeconds: number;
  private readonly refreshExpiry: NonNullable<SignOptions['expiresIn']>;

  constructor(
    secret: string,
    expirySeconds: number = 30 * 24 * 60 * 60,
    refreshSecret?: string,
    refreshExpiry: string | number = '7d',
  ) {
    if (!secret) {
      throw new Error('JWT_SECRET is required for JwtService');
    }
    this.secret = secret;
    this.refreshSecret = refreshSecret || secret;
    this.expirySeconds = expirySeconds;
    this.refreshExpiry = refreshExpiry as NonNullable<SignOptions['expiresIn']>;
  }

  signToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expirySeconds });
  }

  verifyToken(token: string): DecodedToken {
    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, this.secret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Session expired. Please login again.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token. Please login again.');
      }
      throw new UnauthorizedError('Authentication failed.');
    }
    if (!this.isDecodedToken(decoded)) {
      throw new UnauthorizedError('Invalid token. Please login again.');
    }
    return decoded;
  }

  signRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiry });
  }

  verifyRefreshToken(token: string): DecodedToken {
    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, this.refreshSecret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Session expired. Please login again.');
      }
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }
    if (!this.isDecodedToken(decoded)) {
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }
    return decoded;
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  compareTokenHash(token: string, storedHash: string): boolean {
    const tokenHash = this.hashToken(token);
    if (tokenHash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(storedHash));
  }

  private isDecodedToken(payload: unknown): payload is DecodedToken {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return (
      typeof p['userId'] === 'string' &&
      typeof p['phone'] === 'string' &&
      typeof p['role'] === 'string' &&
      typeof p['iat'] === 'number' &&
      typeof p['exp'] === 'number'
    );
  }
}
