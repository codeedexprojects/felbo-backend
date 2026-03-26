import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../src/shared/database/mongo';
import { logger } from '../src/shared/logger/logger';

/**
 * DATABASE CLEANUP SCRIPT
 * 
 * Clears all data from the database EXCEPT for:
 * 1. Admin accounts (admins)
 * 2. System configurations (systemconfigs)
 * 
 * Usage: npx tsx src/scripts/clear-db.ts
 */

async function clearData() {
  try {
    logger.info('Starting database cleanup...');
    await connectMongo();
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const collections = await db.listCollections().toArray();
    const keepCollections = ['admins', 'systemconfigs'];
    
    for (const collection of collections) {
      if (!keepCollections.includes(collection.name)) {
        logger.info(`Cleaning collection: ${collection.name}`);
        await db.collection(collection.name).deleteMany({});
      } else {
        logger.info(`Skipping essential collection: ${collection.name}`);
      }
    }
    
    logger.info('Database cleanup completed successfully.');
  } catch (error) {
    logger.error('Error during database cleanup:', {
      message: (error as Error).message,
      stack: (error as Error).stack
    });
  } finally {
    await disconnectMongo();
    process.exit(0);
  }
}

clearData();
