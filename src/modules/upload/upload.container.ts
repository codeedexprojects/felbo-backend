import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import { vendorService } from '../vendor/vendor.container';
import UploadService from './upload.service';
import UploadController from './upload.controller';

const uploadService = new UploadService(
  vendorService,
  config.aws.bucket,
  config.aws.region,
  logger,
);

const uploadController = new UploadController(uploadService);

export { uploadService, uploadController };
