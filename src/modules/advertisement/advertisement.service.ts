import { AdvertisementRepository } from './advertisement.repository';
import {
  CreateAdInput,
  UpdateAdInput,
  AdDto,
  ListAdsFilter,
  ListAdsResponse,
  ListUserAdsResponse,
} from './advertisement.types';
import { IAd } from './advertisement.model';
import { NotFoundError, ConflictError } from '../../shared/errors';
import ShopService from '../shop/shop.service';

export class AdvertisementService {
  constructor(
    private readonly advertisementRepository: AdvertisementRepository,
    private readonly shopService: ShopService,
  ) {}

  async createAd(input: CreateAdInput, adminId: string): Promise<AdDto> {
    await this.shopService.getShopById(input.shopId);
    const ad = await this.advertisementRepository.create({ ...input, createdBy: adminId });
    return this.toDto(ad);
  }

  async listAds(filter: ListAdsFilter): Promise<ListAdsResponse> {
    const { ads, total } = await this.advertisementRepository.findAll(filter);
    return {
      ads: ads.map((a) => this.toDto(a)),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  async listUserAds(filter: ListAdsFilter): Promise<ListUserAdsResponse> {
    const { ads, total } = await this.advertisementRepository.findAllActiveWithShop(filter);

    return {
      ads: ads.map((a) => ({
        id: a._id.toString(),
        title: a.title,
        subtitle: a.subtitle ?? '',
        image: a.bannerImage,
        targetShop: {
          id: a.shopId._id.toString(),
          name: a.shopId.name,
          address: {
            area: a.shopId.address.area,
            city: a.shopId.address.city,
          },
        },
      })),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  async getAdById(id: string): Promise<AdDto> {
    const ad = await this.advertisementRepository.findById(id);
    if (!ad || !ad.isActive) throw new NotFoundError('Advertisement not found.');
    return this.toDto(ad);
  }

  async updateAd(id: string, input: UpdateAdInput): Promise<AdDto> {
    const ad = await this.advertisementRepository.findById(id);
    if (!ad || !ad.isActive) throw new NotFoundError('Advertisement not found.');

    if (input.isActive === false) {
      const activeCount = await this.advertisementRepository.countActive();
      if (activeCount <= 1) {
        throw new ConflictError(
          'Cannot deactivate the last advertisement. At least one banner must remain active.',
        );
      }
    }

    if (input.shopId) {
      await this.shopService.getShopById(input.shopId);
    }

    const updated = await this.advertisementRepository.updateById(id, input);
    if (!updated) throw new NotFoundError('Advertisement not found.');
    return this.toDto(updated);
  }

  async deleteAd(id: string): Promise<void> {
    const ad = await this.advertisementRepository.findById(id);
    if (!ad || !ad.isActive) throw new NotFoundError('Advertisement not found.');

    const activeCount = await this.advertisementRepository.countActive();
    if (activeCount <= 1) {
      throw new ConflictError(
        'Cannot delete the last advertisement. At least one banner must remain active.',
      );
    }

    await this.advertisementRepository.deleteById(id);
  }

  private toDto(ad: IAd): AdDto {
    return {
      id: ad._id.toString(),
      title: ad.title,
      subtitle: ad.subtitle,
      description: ad.description,
      bannerImage: ad.bannerImage,
      shopId: ad.shopId.toString(),
      createdBy: ad.createdBy.toString(),
      priority: ad.priority,
      isActive: ad.isActive,
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt,
    };
  }
}
