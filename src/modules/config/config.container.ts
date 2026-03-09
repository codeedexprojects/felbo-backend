import { logger } from '../../shared/logger/logger';
import { getRedisClient } from '../../shared/redis/redis';
import { ConfigRepository } from './config.repository';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';

const configRepository = new ConfigRepository();
export const configService = new ConfigService(configRepository, () => getRedisClient(), logger);
const configController = new ConfigController(configService);

export { configRepository, configController };
