import { Types } from 'mongoose';
import { ClientSession } from '../../shared/database/transaction';
import { Logger } from 'winston';
import ShopRepository from './shop.repository';
import { IShop } from './shop.model';

import {
  CreateShopInput,
  UpdateShopInput,
  UpdateWorkingHoursInput,
  ToggleShopAvailableInput,
  CompleteProfileInput,
  NearbyShopsInput,
  RecommendedShopsInput,
  SearchShopsInput,
  SearchShopsResponse,
  ShopSearchResultDto,
  ShopDto,
  VendorShopDto,
  NearbyShopCardDto,
  NearbyShopsResponse,
  ServiceDto,
  BarberDto,
  BarberServiceDto,
  AdminBarberSummaryDto,
  AdminServiceSummaryDto,
  PublicBarberDto,
  ShopDetailsDto,
  OnboardingStatus,
  AdminShopSearchInput,
  AdminShopSearchResponse,
} from './shop.types';
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/index';
import { ConfigService } from '../config/config.service';
import { CONFIG_KEYS } from '../../shared/config/config.keys';

import { BarberService } from '../barber/barber.service';
import { BarberManagementDto, BarberServiceLinkDto } from '../barber/barber.types';
import { ServiceService } from '../service/service.service';
import UserService from '../user/user.service';
import { FavoriteService } from '../favorite/favorite.service';

export default class ShopService {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly logger: Logger,
    private readonly getBarberService: () => BarberService,
    private readonly getServiceService: () => ServiceService,
    private readonly getUserService: () => UserService,
    private readonly configService: ConfigService,
    private readonly getFavoriteService?: () => FavoriteService,
  ) {}

  private get barberService(): BarberService {
    return this.getBarberService();
  }

  private get serviceService(): ServiceService {
    return this.getServiceService();
  }

  private get userService(): UserService {
    return this.getUserService();
  }

  private async getFavoriteShopIds(userId?: string): Promise<Set<string>> {
    if (!userId || !this.getFavoriteService) return new Set();
    return this.getFavoriteService().getFavoriteShopIds(userId);
  }

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
      isAvailable: shop.isAvailable,
      status: shop.status,
      onboardingStatus: shop.onboardingStatus,
    };
  }

  private toBarberServiceDto(bs: BarberServiceLinkDto): BarberServiceDto {
    return {
      id: bs.id,
      serviceId: bs.serviceId,
      durationMinutes: bs.durationMinutes,
      isActive: bs.isActive,
    };
  }

  private toBarberDto(
    barber: BarberManagementDto,
    barberServices: BarberServiceLinkDto[],
  ): BarberDto {
    return {
      id: barber.id,
      shopId: barber.shopId,
      name: barber.name,
      phone: barber.phone,
      photo: barber.photo,
      rating: barber.rating,
      status: barber.status,
      isAvailable: barber.isAvailable,
      services: barberServices.map((bs) => this.toBarberServiceDto(bs)),
    };
  }

  private async assertShopOwnership(shopId: string, vendorId: string): Promise<IShop> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') {
      throw new NotFoundError('Shop not found.');
    }

    if (shop.vendorId.toString() !== vendorId) {
      throw new ForbiddenError('You do not own this shop.');
    }

    return shop;
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

  async getMyShops(vendorId: string): Promise<ShopDto[]> {
    const shops = await this.shopRepository.findAllByVendorId(vendorId);
    return shops.map((shop) => this.toShopDto(shop));
  }

  async getMyShopsWithBarberProfile(vendorId: string): Promise<VendorShopDto[]> {
    const shops = await this.shopRepository.findAllByVendorId(vendorId);
    const barberProfile = await this.barberService.getVendorBarberProfile(vendorId);

    return shops.map((shop) => {
      const shopId = shop._id.toString();
      const myBarberProfile =
        barberProfile && barberProfile.shopId === shopId
          ? {
              id: barberProfile.id,
              name: barberProfile.name,
              isAvailable: barberProfile.isAvailable,
            }
          : null;

      return { ...this.toShopDto(shop), myBarberProfile };
    });
  }

  async getShop(shopId: string, vendorId: string): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);
    return this.toShopDto(shop);
  }

  async getShopById(shopId: string): Promise<ShopDto> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') throw new NotFoundError('Shop not found.');
    return this.toShopDto(shop);
  }

  async getShopsByIds(shopIds: string[]): Promise<ShopDto[]> {
    const shops = await this.shopRepository.findByIds(shopIds);
    return shops.map((s) => this.toShopDto(s));
  }

  // --- Soft delete (status) ---
  async deleteShop(shopId: string, vendorId: string): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    const updated = await this.shopRepository.updateStatus(shop._id.toString(), 'DELETED');
    if (!updated) throw new NotFoundError('Shop not found.');

    this.logger.info({
      action: 'SHOP_DELETED',
      module: 'shop',
      shopId: shop._id.toString(),
      vendorId,
    });

    return this.toShopDto(updated);
  }

  // --- Availability toggle ---
  async toggleShopAvailable(
    shopId: string,
    vendorId: string,
    input: ToggleShopAvailableInput,
  ): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    const updated = await this.shopRepository.updateIsAvailable(
      shop._id.toString(),
      input.isAvailable,
    );
    if (!updated) throw new NotFoundError('Shop not found.');

    this.logger.info({
      action: 'SHOP_AVAILABILITY_TOGGLED',
      module: 'shop',
      shopId: shop._id.toString(),
      vendorId,
      isAvailable: input.isAvailable,
    });

    return this.toShopDto(updated);
  }

  async updateShop(shopId: string, vendorId: string, input: UpdateShopInput): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

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

  async updateWorkingHours(
    shopId: string,
    vendorId: string,
    input: UpdateWorkingHoursInput,
  ): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

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

  // Onboarding
  async completeProfile(
    shopId: string,
    vendorId: string,
    input: CompleteProfileInput,
  ): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    if (shop.onboardingStatus !== 'PENDING_PROFILE') {
      throw new ConflictError('Profile has already been completed.');
    }

    const updated = await this.shopRepository.completeProfile(
      shopId,
      {
        description: input.description,
        workingHours: input.workingHours,
        photos: input.photos,
      },
      'PENDING_SERVICES',
    );

    if (!updated) {
      throw new NotFoundError('Shop not found.');
    }

    this.logger.info({
      action: 'SHOP_PROFILE_COMPLETED',
      module: 'shop',
      shopId,
      vendorId,
    });

    return this.toShopDto(updated);
  }

  // --- Public discovery ---
  async getShopDetails(shopId: string, userId?: string): Promise<ShopDetailsDto> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') {
      throw new NotFoundError('Shop not found.');
    }

    const [barbers, favoriteShopIds] = await Promise.all([
      this.barberService.getBarbersByShopId(shopId),
      this.getFavoriteShopIds(userId),
    ]);

    const publicBarbers: PublicBarberDto[] = barbers.slice(0, 4).map((b) => ({
      id: b.id,
      name: b.name,
      photo: b.photo,
      rating: b.rating,
      isAvailableToday: b.isAvailable,
    }));

    return {
      id: shop._id.toString(),
      name: shop.name,
      description: shop.description,
      shopType: shop.shopType,
      address: shop.address,
      location: shop.location,
      rating: shop.rating,
      workingHours: shop.workingHours,
      photos: shop.photos,
      barbers: publicBarbers,
      isFavorite: favoriteShopIds.has(shopId),
    };
  }

  private getTodayClosingTime(shop: IShop): string | null {
    if (!shop.workingHours) return null;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = days[new Date().getDay()] as keyof typeof shop.workingHours;
    const todayHours = shop.workingHours[todayKey];
    if (!todayHours || !todayHours.isOpen) return null;
    return todayHours.close;
  }

  async getNearbyShops(input: NearbyShopsInput): Promise<NearbyShopsResponse> {
    const maxDistance = await this.configService.getValueAsNumber(
      CONFIG_KEYS.SHOP_MAX_DISTANCE_METERS,
    );
    const limit = input.limit ?? 20;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const { results, total } = await this.shopRepository.findNearby(
      input.longitude,
      input.latitude,
      maxDistance,
      { shopType: input.shopType, categoryId: input.categoryId },
      skip,
      limit,
    );

    const shopIds = results.map((r) => r.shop._id.toString());
    const [allServices, favoriteShopIds] = await Promise.all([
      this.serviceService.getServicesByShopIds(shopIds),
      this.getFavoriteShopIds(input.userId),
    ]);

    const servicesByShopId = new Map<string, string[]>();
    for (const svc of allServices) {
      const key = svc.shopId;
      if (!servicesByShopId.has(key)) servicesByShopId.set(key, []);
      const names = servicesByShopId.get(key)!;
      if (names.length < 3) names.push(svc.name);
    }

    const shops: NearbyShopCardDto[] = results.map((r) => {
      const shop = r.shop;
      const shopId = shop._id.toString();
      return {
        id: shopId,
        image: shop.photos?.[0] ?? null,
        name: shop.name,
        shopType: shop.shopType,
        address: shop.address,
        isAvailable: shop.isAvailable,
        closingTime: this.getTodayClosingTime(shop),
        distance: Math.round(r.distance / 100) / 10,
        topServices: servicesByShopId.get(shopId) ?? [],
        isFavorite: favoriteShopIds.has(shopId),
        rating: shop.rating,
      };
    });

    return { shops, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getRecommendedShops(input: RecommendedShopsInput): Promise<NearbyShopsResponse> {
    const limit = input.limit ?? 20;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const [user, favoriteShopIds] = await Promise.all([
      this.userService.getUserById(input.userId).catch(() => null),
      this.getFavoriteShopIds(input.userId),
    ]);
    const gender = user?.gender ?? null;

    const shopTypes =
      gender === 'MALE' ? ['MENS', 'UNISEX'] : gender === 'FEMALE' ? ['WOMENS', 'UNISEX'] : null;

    const maxDistance = await this.configService.getValueAsNumber(
      CONFIG_KEYS.RECOMMENDED_SHOPS_MAX_DISTANCE_METERS,
    );
    const { results, total } = await this.shopRepository.findRecommended(
      input.longitude,
      input.latitude,
      maxDistance,
      shopTypes,
      skip,
      limit,
      input.categoryId,
    );

    const shopIds = results.map((r) => r.shop._id.toString());
    const allServices = await this.serviceService.getServicesByShopIds(shopIds);

    const servicesByShopId = new Map<string, string[]>();
    for (const svc of allServices) {
      const key = svc.shopId;
      if (!servicesByShopId.has(key)) servicesByShopId.set(key, []);
      const names = servicesByShopId.get(key)!;
      if (names.length < 3) names.push(svc.name);
    }

    const shops: NearbyShopCardDto[] = results.map((r) => {
      const shop = r.shop;
      const shopId = shop._id.toString();
      return {
        id: shopId,
        image: shop.photos?.[0] ?? null,
        name: shop.name,
        shopType: shop.shopType,
        address: shop.address,
        isAvailable: shop.isAvailable,
        closingTime: this.getTodayClosingTime(shop),
        distance: Math.round(r.distance / 100) / 10,
        topServices: servicesByShopId.get(shopId) ?? [],
        isFavorite: favoriteShopIds.has(shopId),
        rating: shop.rating,
      };
    });

    return { shops, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async searchShops(input: SearchShopsInput): Promise<SearchShopsResponse> {
    const limit = input.limit ?? 20;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const { shops, total } = await this.shopRepository.searchByName(
      input.query,
      {
        shopType: input.shopType,
        categoryId: input.categoryId,
        latitude: input.latitude,
        longitude: input.longitude,
        maxDistanceMeters: input.maxDistanceMeters,
      },
      skip,
      limit,
    );

    const shopIds = shops.map((s) => s._id.toString());
    const allServices = await this.serviceService.getServicesByShopIds(shopIds);

    const servicesByShopId = new Map<string, typeof allServices>();
    for (const svc of allServices) {
      const key = svc.shopId;
      if (!servicesByShopId.has(key)) servicesByShopId.set(key, []);
      servicesByShopId.get(key)!.push(svc);
    }

    const result: ShopSearchResultDto[] = shops.map((s) => {
      const shopId = s._id.toString();
      const shopServices = (servicesByShopId.get(shopId) ?? []).map((svc) => ({
        id: svc.id,
        name: svc.name,
        basePrice: svc.basePrice,
      }));

      const dto: ShopSearchResultDto = {
        id: shopId,
        name: s.name,
        photos: s.photos ?? [],
        shopType: s.shopType,
        address: s.address,
        services: shopServices,
        rating: s.rating,
      };

      if ('distance' in s && typeof s.distance === 'number') {
        dto.distance = Math.round(s.distance);
      }

      return dto;
    });

    return { shops: result, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getBarbersByShopId(shopId: string): Promise<BarberDto[]> {
    const barbers = await this.barberService.getBarbersByShopId(shopId);
    return barbers.map((b) => this.toBarberDto(b, []));
  }

  async getServicesByShopId(shopId: string): Promise<ServiceDto[]> {
    return this.serviceService.getServicesByShopId(shopId);
  }

  async getActiveServicesByIds(serviceIds: string[], shopId: string): Promise<ServiceDto[]> {
    return this.serviceService.getActiveServicesByIds(serviceIds, shopId);
  }

  async syncShopCategory(shopId: string, categoryId: string): Promise<void> {
    await this.shopRepository.addCategoryIfMissing(shopId, categoryId);
  }

  async removeCategoryFromShop(shopId: string, categoryId: string): Promise<void> {
    await this.shopRepository.removeCategoryFromShop(shopId, categoryId);
  }

  async updateOnboardingStatus(
    shopId: string,
    status: OnboardingStatus,
    session?: ClientSession,
  ): Promise<void> {
    await this.shopRepository.updateOnboardingStatus(shopId, status, session);
  }

  async getBarbersByShopIds(shopIds: string[]): Promise<AdminBarberSummaryDto[]> {
    const barbers = await this.barberService.getBarbersByShopIds(shopIds);

    return barbers.map((b) => ({
      id: b.id,
      name: b.name,
      phone: b.phone,
      photo: b.photo,
      isAvailable: b.isAvailable,
      shopId: b.shopId,
    }));
  }

  async getServicesByShopIds(shopIds: string[]): Promise<AdminServiceSummaryDto[]> {
    return this.serviceService.getServicesByShopIds(shopIds);
  }

  async updateRating(shopId: string, average: number, count: number): Promise<void> {
    await this.shopRepository.updateRating(shopId, average, count);
  }

  async getShopIdsByVendorIds(vendorIds: Types.ObjectId[]): Promise<Types.ObjectId[]> {
    return this.shopRepository.findIdsByVendorIds(vendorIds);
  }

  async adminSearchShops(input: AdminShopSearchInput): Promise<AdminShopSearchResponse> {
    const limit = input.limit ?? 20;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const { results, total } = await this.shopRepository.adminSearchShops(input.query, skip, limit);

    return { shops: results, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
