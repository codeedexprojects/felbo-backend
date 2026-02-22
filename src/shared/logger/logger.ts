import winston from 'winston';
import { config } from '../config/config.service';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), winston.format.json());

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: config.nodeEnv === 'production' ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});
