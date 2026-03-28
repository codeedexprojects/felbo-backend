import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import UploadService from './upload.service';
import { MIME_TO_EXT } from './upload.constants';
import { uploadBodySchema, verifyKeySchema } from './upload.validators';

export default class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  generateUploadUrl =
    (prefix: string, appendUserId = false, subPath?: string) =>
    async (req: Request, res: Response): Promise<void> => {
      const { mimeType } = uploadBodySchema.parse(req.body);
      const ext = MIME_TO_EXT[mimeType];
      const mid = appendUserId ? `${req.user!.sub}/` : '';
      const sub = subPath ? `${subPath}/` : '';
      const key = `${prefix}${mid}${sub}${randomUUID()}.${ext}`;
      const result = await this.uploadService.generateUploadUrlForKey(key, mimeType);

      res.status(200).json({ success: true, data: result });
    };

  verifyUpload =
    (prefix: string, appendUserId = false, subPath?: string) =>
    async (req: Request, res: Response): Promise<void> => {
      const { key } = verifyKeySchema.parse(req.body);
      const mid = appendUserId ? `${req.user!.sub}/` : '';
      const sub = subPath ? `${subPath}/` : '';
      const expectedPrefix = `${prefix}${mid}${sub}`;

      if (!key.startsWith(expectedPrefix)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid key: does not belong to this context.',
          },
        });
        return;
      }

      const result = await this.uploadService.verifyUploadByKey(key);
      res.status(200).json({ success: true, data: result });
    };
}
