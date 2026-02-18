import { ClientSession } from 'mongoose';
import { Logger } from 'winston';
import ShopRepository from './shop.repository';
import { IShop } from './shop.model';
import {
  CreateShopInput,
  UpdateShopInput,
  UpdateWorkingHoursInput,
  NearbyShopsInput,
  SearchShopsInput,
  ShopDto,
  NearbyShopDto,
} from './shop.types';
import { NotFoundError, ForbiddenError } from '../../shared/errors/index';

const DEFAULT_MAX_DISTANCE = 10000; // 10 km
const DEFAULT_PAGE_LIMIT = 20;

export default class ShopService {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly logger: Logger,
  ) {}

  private toShopDto(shop: IShop): ShopDto {
    return {
      id: shop._id.toString(),
      vendorId: shop.vendorId.toString(),
      name: shop.name,
      description: shop.description,
      shopType: shop.shopType,
      phone: shop.phone,
      address: shop.address,
      location: shop.location,
      workingHours: shop.workingHours,
      photos: shop.photos,
      rating: shop.rating,
      isActive: shop.isActive,
      status: shop.status,
    };
  }

  private toNearbyShopDto(shop: IShop, distance: number): NearbyShopDto {
    return {
      ...this.toShopDto(shop),
      distance: Math.round(distance),
    };
  }

  async createShopForVendor(input: CreateShopInput, session?: ClientSession): Promise<ShopDto> {
    const shop = await this.shopRepository.create(input, session);

    this.logger.info({
      action: 'SHOP_CREATED',
      module: 'shop',
      shopId: shop._id.toString(),
      vendorId: input.vendorId,
    });

    return this.toShopDto(shop);
  }

  async getMyShop(vendorId: string): Promise<ShopDto> {
    const shop = await this.shopRepository.findByVendorId(vendorId);
    if (!shop) {
      throw new NotFoundError('Shop not found.');
    }
    return this.toShopDto(shop);
  }

  async updateMyShop(vendorId: string, input: UpdateShopInput): Promise<ShopDto> {
    const shop = await this.shopRepository.findByVendorId(vendorId);
    if (!shop) {
      throw new NotFoundError('Shop not found.');
    }
    if (shop.status === 'DELETED') {
      throw new ForbiddenError('Cannot update a deleted shop.');
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.shopType !== undefined) updateData.shopType = input.shopType;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.location !== undefined) {
      updateData.location = {
        type: 'Point' as const,
        coordinates: [input.location.longitude, input.location.latitude],
      };
    }
    if (input.photos !== undefined) updateData.photos = input.photos;

    const updated = await this.shopRepository.updateById(shop._id.toString(), updateData);
    if (!updated) {
      throw new NotFoundError('Shop not found.');
    }

    this.logger.info({
      action: 'SHOP_UPDATED',
      module: 'shop',
      shopId: shop._id.toString(),
      vendorId,
    });

    return this.toShopDto(updated);
  }

  async updateWorkingHours(vendorId: string, input: UpdateWorkingHoursInput): Promise<ShopDto> {
    const shop = await this.shopRepository.findByVendorId(vendorId);
    if (!shop) {
      throw new NotFoundError('Shop not found.');
    }

    const updated = await this.shopRepository.updateWorkingHours(
      shop._id.toString(),
      input.workingHours,
    );
    if (!updated) {
      throw new NotFoundError('Shop not found.');
    }

    this.logger.info({
      action: 'SHOP_WORKING_HOURS_UPDATED',
      module: 'shop',
      shopId: shop._id.toString(),
      vendorId,
    });

    return this.toShopDto(updated);
  }

  async getShopById(shopId: string): Promise<ShopDto> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') {
      throw new NotFoundError('Shop not found.');
    }
    return this.toShopDto(shop);
  }

  async getNearbyShops(input: NearbyShopsInput): Promise<NearbyShopDto[]> {
    const maxDistance = input.maxDistanceMeters ?? DEFAULT_MAX_DISTANCE;
    const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const results = await this.shopRepository.findNearby(
      input.longitude,
      input.latitude,
      maxDistance,
      { shopType: input.shopType },
      skip,
      limit,
    );

    return results.map((r) => this.toNearbyShopDto(r.shop, r.distance));
  }

  async searchShops(input: SearchShopsInput): Promise<ShopDto[]> {
    const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const shops = await this.shopRepository.searchByName(
      input.query,
      { city: input.city, shopType: input.shopType },
      skip,
      limit,
    );

    return shops.map((s) => this.toShopDto(s));
  }
}
