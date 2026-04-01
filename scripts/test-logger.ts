import { logger } from '../src/shared/logger/logger';

for (let i = 0; i < 200; i++) {
  logger.info('Test log entry', { index: i, payload: 'x'.repeat(100) });
  logger.warn('Test warning', { index: i });
  logger.error('Test error', { index: i, error: new Error('boom').stack });
}

logger.info('Done — check the logs/ directory');
