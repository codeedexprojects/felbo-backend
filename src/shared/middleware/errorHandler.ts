import { Request, Response, NextFunction } from 'express';
import z, { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { logger } from '../logger/logger';
import mongoose from 'mongoose';

function isDuplicateKeyError(err: Error | unknown): err is mongoose.mongo.MongoServerError {
  return err instanceof mongoose.mongo.MongoServerError && err.code === 11000;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Dev error:', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const flattened = z.flattenError(err);
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fieldErrors: flattened.fieldErrors,
      },
    });
    return;
  }

  if (isDuplicateKeyError(err)) {
    const [field, value] = Object.entries(err.keyValue ?? {})[0] ?? ['field', ''];

    res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `A record with this ${field} '${String(value)}' already exists.`,
      },
    });
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
