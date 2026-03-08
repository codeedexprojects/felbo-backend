import { Request, Response } from 'express';
import { ConfigService } from './config.service';
import { categoryParamSchema, keyParamSchema, updateConfigSchema } from './config.validators';

export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.configService.getAllConfigs();
    res.status(200).json({ success: true, data: result });
  };

  getByCategory = async (req: Request, res: Response): Promise<void> => {
    const { category } = categoryParamSchema.parse(req.params);
    const result = await this.configService.getConfigsByCategory(category);
    res.status(200).json({ success: true, data: result });
  };

  updateConfig = async (req: Request, res: Response): Promise<void> => {
    const { key } = keyParamSchema.parse(req.params);
    const { value } = updateConfigSchema.parse(req.body);
    const adminId = req.user!.sub;

    const result = await this.configService.updateConfig(key, value, adminId);
    res.status(200).json({ success: true, data: result });
  };
}
