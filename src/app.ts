import cors from 'cors';
import router from './routes';
import helmet from 'helmet';
import morgan from 'morgan';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { requestId } from './shared/middleware/requestId';
import { errorHandler } from './shared/middleware/errorHandler';
import { setupBullBoard } from '@shared/queue/bull-board';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(compression());

app.use(
  '/api/v1/webhooks',
  express.raw({ type: 'application/json' }),
  (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (Buffer.isBuffer(req.body)) {
      (req as express.Request & { rawBody: string }).rawBody = req.body.toString('utf8');
      req.body = JSON.parse((req as express.Request & { rawBody: string }).rawBody);
    }
    next();
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupBullBoard(app);

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
