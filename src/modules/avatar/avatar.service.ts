import { AvatarRepository } from './avatar.repository';
import { AvatarDto, DeleteAvatarResponse, ListAvatarsResponse } from './avatar.types';
import { IAvatar } from './avatar.model';
import { NotFoundError, ValidationError } from '@shared/errors';
import UploadService from '../upload/upload.service';

export class AvatarService {
  constructor(
    private readonly avatarRepository: AvatarRepository,
    private readonly uploadService: UploadService,
  ) {}

  async listAvatars(): Promise<ListAvatarsResponse> {
    const avatars = await this.avatarRepository.findAll();
    return { avatars: avatars.map(this.toDto) };
  }

  async addAvatar(key: string): Promise<AvatarDto> {
    if (!key.startsWith('avatars/')) {
      throw new ValidationError('Invalid key: must belong to avatars prefix.');
    }

    const { permanentUrl } = await this.uploadService.verifyUploadByKey(key);
    const avatar = await this.avatarRepository.create({ imageUrl: permanentUrl, key });
    return this.toDto(avatar);
  }

  async deleteAvatar(id: string): Promise<DeleteAvatarResponse> {
    const avatar = await this.avatarRepository.findById(id);
    if (!avatar) throw new NotFoundError('Avatar not found.');

    await this.uploadService.deleteObjectByKey(avatar.key);
    await this.avatarRepository.deleteById(id);

    return { message: 'Avatar deleted successfully.' };
  }

  private toDto(avatar: IAvatar): AvatarDto {
    return {
      id: avatar._id.toString(),
      imageUrl: avatar.imageUrl,
      createdAt: avatar.createdAt,
    };
  }
}
