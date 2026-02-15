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

export const config = {
  node_env: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '3000'), 10),

  mongo: {
    uri: getEnv('MONGODB_URI', 'mongodb://localhost:27017/felbo'),
  },

  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: parseInt(getEnv('REDIS_PORT', '6379'), 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: getEnv('JWT_SECRET', 'development_secret_key_change_in_production'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '30d'),
    adminExpiresIn: getEnv('JWT_ADMIN_EXPIRES_IN', '8h'),
  },
} as const;
