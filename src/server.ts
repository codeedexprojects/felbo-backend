import app from './app';
import { config } from './shared/config/config.service';
import { logger } from './shared/logger/logger';
import { connectMongo } from './shared/database/mongo';
import { connectRedis } from './shared/redis/redis';
import { uploadService } from './modules/upload/upload.container';
import { SEVEN_DAYS_MS } from './shared/constants';

async function bootstrap(): Promise<void> {
  await connectMongo();
  await connectRedis();

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });

  void uploadService.runCleanupJob();
  setInterval(() => void uploadService.runCleanupJob(), SEVEN_DAYS_MS);
  logger.info({ action: 'CLEANUP_JOB_SCHEDULED', module: 'upload', intervalDays: SEVEN_DAYS_MS });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
