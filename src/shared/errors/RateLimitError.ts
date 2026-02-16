import { AppError } from './AppError';

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}
