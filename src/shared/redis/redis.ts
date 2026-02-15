import { createClient, RedisClientType } from 'redis';
import { config } from '../config/config.service';
import { logger } from '../logger/logger';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<RedisClientType> {
  redisClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
    password: config.redis.password,
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  await redisClient.connect();
  return redisClient;
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}
