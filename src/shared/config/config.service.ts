import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

const isProduction = getEnv('NODE_ENV', 'development') === 'production';

export const config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  isProduction,
  port: getEnvInt('PORT', 3000),

  mongo: {
    uri: getEnv('MONGODB_URI', 'mongodb://localhost:27017/felbo'),
  },

  redis: {
    url: process.env.REDIS_URL || undefined,
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvInt('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: getEnv('JWT_SECRET', 'development_secret_key_change_in_production'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', 'development_refresh_secret_change_in_production'),
    expirySeconds: getEnvInt('JWT_EXPIRY_SECONDS', 15 * 60), // 15 minutes
    adminExpirySeconds: getEnvInt('JWT_ADMIN_EXPIRY_SECONDS', 8 * 60 * 60), // 8 hours
    refreshExpiry: getEnv('JWT_REFRESH_EXPIRY', '30d'),
    adminRefreshExpiry: getEnv('JWT_ADMIN_REFRESH_EXPIRY', '7d'),
  },

  otp: {
    twoFactorApiKey: getEnv('TWO_FACTOR_API_KEY', ''),
    devFixedOtp: getEnv('DEV_FIXED_OTP', '123456'),
    dailyLimitUser: getEnvInt('OTP_DAILY_LIMIT_USER', 8),
    dailyLimitVendor: getEnvInt('OTP_DAILY_LIMIT_VENDOR', 10),
  },

  razorpay: {
    keyId: getEnv('RAZORPAY_KEY_ID', '') || 'rzp_test_087135',
    keySecret: getEnv('RAZORPAY_KEY_SECRET', '') || 'rzp_test_087135',
    webhookSecret: getEnv('RAZORPAY_WEBHOOK_SECRET', '') || 'rzp_test_087135',
  },

  vendor: {
    registrationFee: getEnvInt('VENDOR_REGISTRATION_FEE', 499),
  },

  brevo: {
    apiKey: getEnv('BREVO_API_KEY', ''),
    fromEmail: getEnv('BREVO_FROM_EMAIL', 'noreply@felbo.in'),
    fromName: getEnv('BREVO_FROM_NAME', 'Felbo'),
  },

  aws: {
    region: getEnv('AWS_REGION', 'ap-south-1'),
    bucket: getEnv('AWS_S3_BUCKET', ''),
  },

  firebase: {
    projectId: getEnv('FIREBASE_PROJECT_ID', ''),
    privateKey: getEnv('FIREBASE_PRIVATE_KEY', ''),
    clientEmail: getEnv('FIREBASE_CLIENT_EMAIL', ''),
  },

  admin: {
    cookie: {
      name: 'adminRefreshToken',
      options: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict' as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/admin',
      },
    },
  },
} as const;
