import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { uploadController } from '../../modules/upload/upload.container';

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again in a minute.',
    },
  },
});

router.post('/url', uploadLimiter, uploadController.generateUploadUrl('vendors/', false));
router.post('/verify', uploadLimiter, uploadController.verifyUpload('vendors/', false));

export default router;
