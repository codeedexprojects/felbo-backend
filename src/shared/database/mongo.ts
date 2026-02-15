import mongoose from 'mongoose';
import { config } from '../config/config.service';
import { logger } from '../logger/logger';

export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(config.mongo.uri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    process.exit(1);
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
