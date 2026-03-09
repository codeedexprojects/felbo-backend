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
  PublicServiceDto,
  PublicBarberDto,
  ShopDetailsDto,
  GetShopDetailsOptions,
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

export default class ShopService {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly logger: Logger,
    private readonly getBarberService: () => BarberService,
    private readonly getServiceService: () => ServiceService,
    private readonly getUserService: () => UserService,
    private readonly configService: ConfigService,
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
  private computeDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000; // Earth radius in metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  async getShopDetails(shopId: string, options?: GetShopDetailsOptions): Promise<ShopDetailsDto> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') {
      throw new NotFoundError('Shop not found.');
    }

    const [services, barbers, barberServices] = await Promise.all([
      this.serviceService.getServicesByShopId(shopId),
      this.barberService.getBarbersByShopId(shopId),
      this.barberService.getBarberServicesByShopId(shopId),
    ]);

    // Build a map of serviceId → list of barber-specific durations
    const durationMap = new Map<string, number[]>();
    for (const bs of barberServices) {
      const sid = bs.serviceId;
      const existing = durationMap.get(sid) ?? [];
      existing.push(bs.durationMinutes);
      durationMap.set(sid, existing);
    }

    const publicServices: PublicServiceDto[] = services.map((s) => {
      const durations = durationMap.get(s.id) ?? [];
      const minDuration = durations.length > 0 ? Math.min(...durations) : s.baseDurationMinutes;
      const maxDuration = durations.length > 0 ? Math.max(...durations) : s.baseDurationMinutes;
      return {
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        basePrice: s.basePrice,
        minDuration,
        maxDuration,
        applicableFor: s.applicableFor,
        description: s.description,
      };
    });

    const publicBarbers: PublicBarberDto[] = barbers.map((b) => ({
      id: b.id,
      name: b.name,
      photo: b.photo,
      rating: b.rating,
      isAvailableToday: b.isAvailable,
    }));

    let distance: number | undefined;
    if (options?.latitude !== undefined && options?.longitude !== undefined) {
      const [shopLon, shopLat] = shop.location.coordinates;
      distance = this.computeDistanceMeters(options.latitude, options.longitude, shopLat, shopLon);
    }

    return {
      id: shop._id.toString(),
      name: shop.name,
      description: shop.description,
      shopType: shop.shopType,
      address: shop.address,
      distance,
      rating: shop.rating,
      workingHours: shop.workingHours,
      photos: shop.photos,
      services: publicServices,
      barbers: publicBarbers,
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
      { shopType: input.shopType },
      skip,
      limit,
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
      };
    });

    return { shops, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getRecommendedShops(input: RecommendedShopsInput): Promise<NearbyShopsResponse> {
    const limit = input.limit ?? 20;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const user = await this.userService.getUserById(input.userId).catch(() => null);
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

  async adminSearchShops(input: AdminShopSearchInput): Promise<AdminShopSearchResponse> {
    const limit = input.limit ?? 20;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const { results, total } = await this.shopRepository.adminSearchShops(input.query, skip, limit);

    return { shops: results, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
