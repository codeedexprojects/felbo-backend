import crypto from 'crypto';

export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const hmacSha256 = (secret: string, data: string): string => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};
