import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { requestId } from './shared/middleware/requestId';
import { errorHandler } from './shared/middleware/errorHandler';
import { userRoutes } from './modules/user/user.routes';
import { vendorRoutes } from './modules/vendor/vendor.routes';
import { shopRoutes } from './modules/shop/shop.routes';
import { paymentRoutes } from './modules/payment/payment.routes';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
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
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/shops', shopRoutes);
app.use('/api/v1/payments', paymentRoutes);

app.use(errorHandler);

export default app;
