import { AppError } from './AppError';

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable. Please try again.') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}
