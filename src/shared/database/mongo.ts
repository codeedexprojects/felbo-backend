import mongoose from 'mongoose';
import { config } from '../config/config.service';
import { logger } from '../logger/logger';

const MONGO_URI = config.mongo.uri;

if (!MONGO_URI) {
  throw new Error('MongoDB URI is not defined in configuration');
}

mongoose.set('strictQuery', true);

export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 5,
    });

    logger.info('MongoDB connected');

    attachMongoListeners();
  } catch (error) {
    logger.error('MongoDB initial connection failed', {
      error: (error as Error).message,
    });
    throw error;
  }
}

export async function disconnectMongo(): Promise<void> {
  try {
    await mongoose.connection.close(false);
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error('MongoDB disconnection failed', {
      error: (error as Error).message,
    });
  }
}

function attachMongoListeners(): void {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connection established');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB runtime error', {
      error: err.message,
    });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('serverDescriptionChanged', (event) => {
    logger.info('MongoDB server description changed', event);
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}
