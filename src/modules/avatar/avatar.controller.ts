import { Request, Response } from 'express';
import { z } from 'zod';
import { AvatarService } from './avatar.service';

const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

const addAvatarSchema = z.object({
  key: z.string().min(1),
});

const avatarIdParamSchema = z.object({
  id: mongoIdSchema,
});

export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  listAvatars = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.avatarService.listAvatars();
    res.json({ success: true, data: result });
  };

  addAvatar = async (req: Request, res: Response): Promise<void> => {
    const { key } = addAvatarSchema.parse(req.body);
    const avatar = await this.avatarService.addAvatar(key);
    res.status(201).json({ success: true, data: avatar });
  };

  deleteAvatar = async (req: Request, res: Response): Promise<void> => {
    const { id } = avatarIdParamSchema.parse(req.params);
    const result = await this.avatarService.deleteAvatar(id);
    res.status(200).json({ success: true, message: result.message });
  };
}
