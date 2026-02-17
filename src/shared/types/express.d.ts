import { DecodedToken } from '../services/jwt.service';

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}
