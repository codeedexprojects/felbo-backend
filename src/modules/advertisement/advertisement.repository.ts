import { Types } from 'mongoose';
import { AdvertisementModel, IAd } from './advertisement.model';
import { ListAdsFilter, PopulatedAdvertisement } from './advertisement.types';

export class AdvertisementRepository {
  async create(data: {
    title: string;
    subtitle: string;
    description: string;
    bannerImage: string;
    shopId: string;
    createdBy: string;
  }): Promise<IAd> {
    return AdvertisementModel.create(data);
  }

  async findAll(filter: ListAdsFilter): Promise<{ ads: IAd[]; total: number }> {
    const skip = (filter.page - 1) * filter.limit;

    const [ads, total] = await Promise.all([
      AdvertisementModel.find({ isActive: true })
        .sort({ priority: 1, createdAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .exec(),
      AdvertisementModel.countDocuments({ isActive: true }).exec(),
    ]);

    return { ads, total };
  }

  async findAllActiveWithShop(
    filter: ListAdsFilter,
  ): Promise<{ ads: PopulatedAdvertisement[]; total: number }> {
    const skip = (filter.page - 1) * filter.limit;

    const [ads, total] = await Promise.all([
      AdvertisementModel.find({ isActive: true })
        .populate<{
          shopId: {
            _id: Types.ObjectId;
            name: string;
            address: { area: string; city: string };
          };
        }>('shopId', 'name address.area address.city')
        .sort({ priority: 1, createdAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean<PopulatedAdvertisement[]>()
        .exec(),

      AdvertisementModel.countDocuments({ isActive: true }),
    ]);

    return { ads, total };
  }

  findById(id: string): Promise<IAd | null> {
    return AdvertisementModel.findById(id).exec();
  }

  updateById(
    id: string,
    data: Partial<
      Pick<IAd, 'title' | 'subtitle' | 'description' | 'bannerImage' | 'isActive' | 'priority'> & {
        shopId: string;
      }
    >,
  ): Promise<IAd | null> {
    return AdvertisementModel.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  async deleteById(id: string): Promise<void> {
    await AdvertisementModel.findByIdAndDelete(id).exec();
  }

  countActive(): Promise<number> {
    return AdvertisementModel.countDocuments({ isActive: true }).exec();
  }
}
