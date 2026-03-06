import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/config.service';
import { logger } from '../logger/logger';

let bullConnection: IORedis;

export function getBullConnection(): IORedis {
  if (!bullConnection) {
    bullConnection = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    bullConnection.on('error', (err) => {
      logger.error('BullMQ Redis connection error', err);
    });
  }
  return bullConnection;
}

export function createQueue<T = unknown>(name: string, opts?: QueueOptions): Queue<T> {
  return new Queue<T>(name, {
    connection: getBullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
    ...opts,
  });
}

export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  SCHEDULED_JOBS: 'scheduled-jobs',
} as const;
