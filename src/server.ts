import app from './app';
import { config } from './shared/config/config.service';
import { logger } from './shared/logger/logger';
import { connectMongo } from './shared/database/mongo';
import { connectRedis } from './shared/redis/redis';

async function bootstrap(): Promise<void> {
  // Connect to databases
  await connectMongo();
  await connectRedis();

  // Start HTTP server
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
