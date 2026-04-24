import app from './app';
import { config } from './shared/config/config.service';
import { logger } from './shared/logger/logger';
import { connectMongo } from './shared/database/mongo';
import { connectRedis } from './shared/redis/redis';
import { configService } from './modules/config/config.container';
import { initFirebase } from './shared/notification/fcm.service';
import { scheduleBarberAvailabilityCron } from './shared/notification/barber.cron';
import { scheduleStatusHealer } from './cron/statusHealer';
import { scheduleS3CleanupCron } from './cron/s3Cleanup';

async function bootstrap(): Promise<void> {
  await connectMongo();
  await connectRedis();
  await configService.initialize();
  initFirebase();

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });

  scheduleBarberAvailabilityCron();
  scheduleStatusHealer();
  scheduleS3CleanupCron();
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
