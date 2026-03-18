import { uploadService } from '../upload/upload.container';
import { AvatarRepository } from './avatar.repository';
import { AvatarService } from './avatar.service';
import { AvatarController } from './avatar.controller';

const avatarRepository = new AvatarRepository();
const avatarService = new AvatarService(avatarRepository, uploadService);
const avatarController = new AvatarController(avatarService);

export { avatarController };
