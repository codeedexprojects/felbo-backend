import { Request, Response } from 'express';
import UploadService from './upload.service';
import { generateUploadUrlSchema, verifyUploadSchema } from './upload.validators';

export default class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  generateUploadUrl = async (req: Request, res: Response): Promise<void> => {
    const validated = generateUploadUrlSchema.parse(req.body);
    const result = await this.uploadService.generateUploadUrl(validated);

    res.status(200).json({ success: true, data: result });
  };

  verifyUpload = async (req: Request, res: Response): Promise<void> => {
    const validated = verifyUploadSchema.parse(req.body);
    const result = await this.uploadService.verifyUpload(validated);

    res.status(200).json({ success: true, data: result });
  };
}
