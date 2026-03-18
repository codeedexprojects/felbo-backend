import { AvatarModel, IAvatar } from './avatar.model';

export class AvatarRepository {
  async findAll(): Promise<IAvatar[]> {
    return AvatarModel.find().sort({ createdAt: -1 }).exec();
  }

  async create(data: { imageUrl: string; key: string }): Promise<IAvatar> {
    return AvatarModel.create(data);
  }

  async findById(id: string): Promise<IAvatar | null> {
    return AvatarModel.findById(id).exec();
  }

  async deleteById(id: string): Promise<void> {
    await AvatarModel.findByIdAndDelete(id).exec();
  }
}
