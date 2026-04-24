import { config } from '../../shared/config/config.service';
import { logger } from '../../shared/logger/logger';
import UploadService from './upload.service';
import UploadController from './upload.controller';

const uploadService = new UploadService(config.aws.bucket, config.aws.region, logger);

const uploadController = new UploadController(uploadService);

export { uploadService, uploadController };
