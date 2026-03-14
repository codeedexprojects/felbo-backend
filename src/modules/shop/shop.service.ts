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
  ShopServicesResponse,
  ShopServicesInput,
  VendorShopListDto,
  ShopAddress,
  AddAdditionalShopInput,
  PendingApprovalShopsResponse,
  PendingApprovalShopDto,
} from './shop.types';
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/index';
import { ConfigService } from '../config/config.service';
import { CONFIG_KEYS } from '../../shared/config/config.keys';

import { BarberService } from '../barber/barber.service';
import { BarberManagementDto, BarberServiceLinkDto } from '../barber/barber.types';
import { ServiceService } from '../service/service.service';
import UserService from '../user/user.service';
import { FavoriteService } from '../favorite/favorite.service';
import { formatRating } from '../../shared/utils/rating';

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
      rating: {
        average: formatRating(shop.rating.average),
        count: shop.rating.count,
      },
      isAvailable: shop.isAvailable && this.isShopOpenToday(shop),
      isPrimary: shop.isPrimary,
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
      rating: {
        average: formatRating(barber.rating.average),
        count: barber.rating.count,
      },
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

  private assertShopActive(shop: IShop): void {
    if (shop.status === 'PENDING_APPROVAL') {
      throw new ForbiddenError('This shop is pending admin approval and cannot be modified.');
    }
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

  async addAdditionalShop(vendorId: string, input: AddAdditionalShopInput): Promise<ShopDto> {
    const existingShops = await this.shopRepository.findAllByVendorId(vendorId);

    const primaryShop = existingShops.find((s) => s.isPrimary && s.status !== 'DELETED');
    if (!primaryShop || primaryShop.onboardingStatus !== 'COMPLETED') {
      throw new ConflictError('Complete setup of your primary shop before adding another.');
    }

    const hasPendingApproval = existingShops.some((s) => s.status === 'PENDING_APPROVAL');
    if (hasPendingApproval) {
      throw new ConflictError(
        'You have a shop pending admin approval. Please wait for it to be approved before adding another.',
      );
    }

    const shop = await this.shopRepository.createCompleted({
      vendorId,
      name: input.name,
      shopType: input.shopType,
      phone: input.phone,
      address: input.address,
      location: input.location,
      description: input.description,
      workingHours: input.workingHours,
      photos: input.photos,
    });

    this.logger.info({
      action: 'SHOP_ADDED',
      module: 'shop',
      shopId: shop._id.toString(),
      vendorId,
    });

    return this.toShopDto(shop);
  }

  async getMyShops(vendorId: string): Promise<ShopDto[]> {
    const shops = await this.shopRepository.findAllByVendorId(vendorId);
    return shops.map((shop) => this.toShopDto(shop));
  }

  async getMyShopsWithBarberProfile(vendorId: string): Promise<VendorShopListDto[]> {
    const shops = await this.shopRepository.findAllByVendorId(vendorId);
    if (shops.length === 0) return [];

    const shopIds = shops.map((s) => s._id.toString());
    const [barberCounts, serviceCounts] = await Promise.all([
      this.barberService.countBarbersByShopIds(shopIds),
      this.serviceService.countServicesByShopIds(shopIds),
    ]);

    return shops.map((shop) => {
      const shopId = shop._id.toString();
      return {
        id: shopId,
        name: shop.name,
        address: this.formatAddress(shop.address),
        serviceCount: serviceCounts.get(shopId) || 0,
        barberCount: barberCounts.get(shopId) || 0,
      };
    });
  }

  private formatAddress(address: ShopAddress): string {
    const parts = [address.line1, address.line2, address.area, address.city].filter(Boolean);
    return parts.join(', ');
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

  async deleteShop(shopId: string, vendorId: string): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);
    this.assertShopActive(shop);

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

  async toggleShopAvailable(
    shopId: string,
    vendorId: string,
    input: ToggleShopAvailableInput,
  ): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);
    this.assertShopActive(shop);

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
    this.assertShopActive(shop);

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
    this.assertShopActive(shop);

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
      rating: {
        average: formatRating(b.rating.average),
        count: b.rating.count,
      },
      isAvailableToday: b.isAvailable,
    }));

    return {
      id: shop._id.toString(),
      name: shop.name,
      description: shop.description,
      shopType: shop.shopType,
      address: shop.address,
      location: shop.location,
      rating: {
        average: formatRating(shop.rating.average),
        count: shop.rating.count,
      },
      workingHours: shop.workingHours,
      photos: shop.photos,
      barbers: publicBarbers,
      isAvailable: shop.isAvailable && this.isShopOpenToday(shop),
      isFavorite: favoriteShopIds.has(shopId),
    };
  }

  private isShopOpenToday(shop: IShop): boolean {
    if (!shop.workingHours) return true;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = days[new Date().getDay()] as keyof typeof shop.workingHours;
    const todayHours = shop.workingHours[todayKey];
    return !!(todayHours && todayHours.isOpen);
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
        isAvailable: shop.isAvailable && this.isShopOpenToday(shop),
        closingTime: this.getTodayClosingTime(shop),
        distance: Math.round(r.distance / 100) / 10,
        topServices: servicesByShopId.get(shopId) ?? [],
        isFavorite: favoriteShopIds.has(shopId),
        rating: {
          average: formatRating(shop.rating.average),
          count: shop.rating.count,
        },
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
        isAvailable: shop.isAvailable && this.isShopOpenToday(shop),
        closingTime: this.getTodayClosingTime(shop),
        distance: Math.round(r.distance / 100) / 10,
        topServices: servicesByShopId.get(shopId) ?? [],
        isFavorite: favoriteShopIds.has(shopId),
        rating: {
          average: formatRating(shop.rating.average),
          count: shop.rating.count,
        },
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
        categoryIds: input.categoryIds,
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
      const shopServices = (servicesByShopId.get(shopId) ?? []).slice(0, 5).map((svc) => ({
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
        isAvailable: s.isAvailable && this.isShopOpenToday(s),
        rating: {
          average: formatRating(s.rating.average),
          count: s.rating.count,
        },
      };

      if ('distance' in s && typeof s.distance === 'number') {
        dto.distance = Math.round(s.distance / 100) / 10;
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

  async incrementShopCancellationCount(
    shopId: string,
  ): Promise<{ cancellationsThisWeek: number; vendorId: string }> {
    const updated = await this.shopRepository.incrementCancellation(shopId);
    if (!updated) throw new NotFoundError('Shop not found.');

    return {
      cancellationsThisWeek: updated.cancellationsThisWeek,
      vendorId: updated.vendorId.toString(),
    };
  }

  async updateRating(shopId: string, average: number, count: number): Promise<void> {
    await this.shopRepository.updateRating(shopId, average, count);
  }

  getShopIdsByVendorIds(vendorIds: string[]): Promise<string[]> {
    return this.shopRepository.findIdsByVendorIds(vendorIds);
  }

  async getPendingApprovalShops(
    page: number,
    limit: number,
  ): Promise<PendingApprovalShopsResponse> {
    const { shops, total } = await this.shopRepository.findPendingApproval(page, limit);

    const dtos: PendingApprovalShopDto[] = shops.map((s) => ({
      id: (s._id as { toString(): string }).toString(),
      name: s.name,
      shopType: s.shopType,
      address: s.address,
      vendorId: s.vendorId.toString(),
      vendorName: s.vendorName,
      vendorPhone: s.vendorPhone,
      createdAt: s.createdAt,
    }));

    return { shops: dtos, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approveShop(shopId: string): Promise<void> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') {
      throw new NotFoundError('Shop not found.');
    }
    if (shop.status !== 'PENDING_APPROVAL') {
      throw new ConflictError('Shop is not pending approval.');
    }

    await this.shopRepository.updateStatus(shopId, 'ACTIVE');

    this.logger.info({
      action: 'SHOP_APPROVED',
      module: 'shop',
      shopId,
      vendorId: shop.vendorId.toString(),
    });
  }

  async rejectShop(shopId: string, reason: string): Promise<void> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') {
      throw new NotFoundError('Shop not found.');
    }
    if (shop.status !== 'PENDING_APPROVAL') {
      throw new ConflictError('Shop is not pending approval.');
    }

    await this.shopRepository.updateStatus(shopId, 'DELETED');

    this.logger.info({
      action: 'SHOP_REJECTED',
      module: 'shop',
      shopId,
      vendorId: shop.vendorId.toString(),
      reason,
    });
  }

  async adminSearchShops(input: AdminShopSearchInput): Promise<AdminShopSearchResponse> {
    const limit = input.limit ?? 20;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const { results, total } = await this.shopRepository.adminSearchShops(input.query, skip, limit);

    return { shops: results, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getShopServices(input: ShopServicesInput): Promise<ShopServicesResponse> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || shop.status === 'DELETED') {
      throw new NotFoundError('Shop not found.');
    }

    const categoriesWithServices = await this.serviceService.getServicesWithCategories(
      input.shopId,
      input.type,
    );

    return {
      categories: categoriesWithServices,
    };
  }
}
