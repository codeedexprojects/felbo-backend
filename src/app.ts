import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { requestId } from './shared/middleware/requestId';
import { errorHandler } from './shared/middleware/errorHandler';
import router from './routes';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(requestId);
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1', (_req, res) => {
  res.json({ message: 'Felbo API v1' });
});

// Routes
app.use('/api/v1/', router);

app.use(errorHandler);

export default app;
