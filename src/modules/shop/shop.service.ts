import { ClientSession } from 'mongoose';
import { Logger } from 'winston';
import ShopRepository from './shop.repository';
import { IShop, IEmbeddedCategory, IService } from './shop.model';

import {
  CreateShopInput,
  UpdateShopInput,
  UpdateWorkingHoursInput,
  CompleteProfileInput,
  AddCategoryInput,
  AddServiceInput,
  UpdateServiceInput,
  NearbyShopsInput,
  SearchShopsInput,
  SearchShopsResponse,
  ShopSearchResultDto,
  ShopDto,
  NearbyShopDto,
  CategoryDto,
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
} from './shop.types';
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/index';

import { BarberService } from '../barber/barber.service';
import { BarberManagementDto, BarberServiceLinkDto } from '../barber/barber.types';

const DEFAULT_MAX_DISTANCE = 10000; // 10 km
const DEFAULT_PAGE_LIMIT = 20;

// TODO: Replace with configService.get('limits.maxServicesPerShop') once config module is implemented
const MAX_SERVICES_PER_SHOP = 50;

export default class ShopService {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly logger: Logger,
    private readonly getBarberService: () => BarberService,
  ) {}

  private get barberService(): BarberService {
    return this.getBarberService();
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
      isActive: shop.isActive,
      status: shop.status,
      onboardingStatus: shop.onboardingStatus,
    };
  }

  private toNearbyShopDto(shop: IShop, distance: number): NearbyShopDto {
    return {
      ...this.toShopDto(shop),
      distance: Math.round(distance),
    };
  }

  private toCategoryDto(category: IEmbeddedCategory, shopId: string): CategoryDto {
    return {
      id: category._id.toString(),
      shopId,
      name: category.name,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
    };
  }

  private toServiceDto(service: IService): ServiceDto {
    return {
      id: service._id.toString(),
      shopId: service.shopId.toString(),
      categoryId: service.categoryId.toString(),
      name: service.name,
      basePrice: service.basePrice,
      baseDurationMinutes: service.baseDurationMinutes,
      applicableFor: service.applicableFor,
      description: service.description,
      status: service.status,
      isActive: service.isActive,
    };
  }

  private toBarberServiceDto(bs: BarberServiceLinkDto): BarberServiceDto {
    return {
      id: bs.id,
      serviceId: bs.serviceId,
      price: bs.price,
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

  async getShop(shopId: string, vendorId: string): Promise<ShopDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);
    return this.toShopDto(shop);
  }

  async getShopById(shopId: string): Promise<ShopDto> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.status === 'DELETED') throw new NotFoundError('Shop not found.');
    return this.toShopDto(shop);
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
      'PENDING_CATEGORIES',
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

  async addCategory(
    shopId: string,
    vendorId: string,
    input: AddCategoryInput,
  ): Promise<CategoryDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    if (shop.onboardingStatus === 'PENDING_PROFILE') {
      throw new ConflictError('Complete your shop profile before adding categories.');
    }

    const isDuplicate = shop.categories.some((c) => c.name === input.name && c.isActive);
    if (isDuplicate) {
      throw new ConflictError('A category with this name already exists.');
    }

    const category = await this.shopRepository.createCategory({
      shopId,
      name: input.name,
      displayOrder: input.displayOrder,
    });

    // Transition onboarding if this is the first category
    if (shop.onboardingStatus === 'PENDING_CATEGORIES') {
      const count = await this.shopRepository.countActiveCategories(shopId);
      if (count === 1) {
        await this.shopRepository.updateOnboardingStatus(shopId, 'PENDING_SERVICES');
      }
    }

    this.logger.info({
      action: 'CATEGORY_ADDED',
      module: 'shop',
      shopId,
      categoryId: category._id.toString(),
      vendorId,
    });

    return this.toCategoryDto(category, shopId);
  }

  async addService(shopId: string, vendorId: string, input: AddServiceInput): Promise<ServiceDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    if (
      shop.onboardingStatus === 'PENDING_PROFILE' ||
      shop.onboardingStatus === 'PENDING_CATEGORIES'
    ) {
      throw new ConflictError('Add at least one category before adding services.');
    }

    const categoryExists = shop.categories.some(
      (c) => c._id.toString() === input.categoryId && c.isActive,
    );
    if (!categoryExists) {
      throw new NotFoundError('Category not found or does not belong to this shop.');
    }

    const service = await this.shopRepository.createService({
      shopId,
      categoryId: input.categoryId,
      name: input.name,
      basePrice: input.basePrice,
      baseDurationMinutes: input.baseDurationMinutes,
      applicableFor: input.applicableFor,
      description: input.description,
    });

    // Transition onboarding if this is the first service
    if (shop.onboardingStatus === 'PENDING_SERVICES') {
      const count = await this.shopRepository.countActiveServices(shopId);
      if (count === 1) {
        await this.shopRepository.updateOnboardingStatus(shopId, 'PENDING_BARBERS');
      }
    }

    this.logger.info({
      action: 'SERVICE_ADDED',
      module: 'shop',
      shopId,
      serviceId: service._id.toString(),
      vendorId,
    });

    return this.toServiceDto(service);
  }

  async createService(
    shopId: string,
    vendorId: string,
    input: AddServiceInput,
  ): Promise<ServiceDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    if (
      shop.onboardingStatus === 'PENDING_PROFILE' ||
      shop.onboardingStatus === 'PENDING_CATEGORIES'
    ) {
      throw new ConflictError('Add at least one category before adding services.');
    }

    const categoryExists = shop.categories.some(
      (c) => c._id.toString() === input.categoryId && c.isActive,
    );
    if (!categoryExists) {
      throw new NotFoundError('Category not found or does not belong to this shop.');
    }

    const currentCount = await this.shopRepository.countActiveServices(shopId);
    if (currentCount >= MAX_SERVICES_PER_SHOP) {
      throw new ConflictError(
        `Shop cannot have more than ${MAX_SERVICES_PER_SHOP} active services.`,
      );
    }

    const service = await this.shopRepository.createService({
      shopId,
      categoryId: input.categoryId,
      name: input.name,
      basePrice: input.basePrice,
      baseDurationMinutes: input.baseDurationMinutes,
      applicableFor: input.applicableFor,
      description: input.description,
    });

    this.logger.info({
      action: 'SERVICE_CREATED',
      module: 'shop',
      shopId,
      serviceId: service._id.toString(),
      vendorId,
    });

    return this.toServiceDto(service);
  }

  async listServices(shopId: string, vendorId: string): Promise<ServiceDto[]> {
    await this.assertShopOwnership(shopId, vendorId);
    const services = await this.shopRepository.findServicesByShopId(shopId);
    return services.map((s) => this.toServiceDto(s));
  }

  async updateService(
    shopId: string,
    vendorId: string,
    serviceId: string,
    input: UpdateServiceInput,
  ): Promise<ServiceDto> {
    await this.assertShopOwnership(shopId, vendorId);

    const service = await this.shopRepository.findServiceById(serviceId);
    if (!service || service.shopId.toString() !== shopId || service.status === 'DELETED') {
      throw new NotFoundError('Service not found.');
    }

    if (input.name && input.name !== service.name) {
      const services = await this.shopRepository.findServicesByShopId(shopId);
      const duplicate = services.some(
        (s) => s.name === input.name && s._id.toString() !== serviceId,
      );
      if (duplicate) throw new ConflictError('A service with this name already exists.');
    }

    const updated = await this.shopRepository.updateService(serviceId, input);
    if (!updated) throw new NotFoundError('Service not found.');

    this.logger.info({
      action: 'SERVICE_UPDATED',
      module: 'shop',
      shopId,
      serviceId,
      vendorId,
    });

    return this.toServiceDto(updated);
  }

  async deleteService(shopId: string, vendorId: string, serviceId: string): Promise<void> {
    await this.assertShopOwnership(shopId, vendorId);

    const service = await this.shopRepository.findServiceById(serviceId);
    if (!service || service.shopId.toString() !== shopId || service.status === 'DELETED') {
      throw new NotFoundError('Service not found.');
    }

    const hasAssigned = await this.barberService.hasAnyAssignedBarber(serviceId);
    if (hasAssigned) {
      throw new ConflictError('Cannot delete service assigned to barbers.');
    }

    await this.shopRepository.softDeleteService(serviceId);

    this.logger.info({
      action: 'SERVICE_DELETED',
      module: 'shop',
      shopId,
      serviceId,
      vendorId,
    });
  }

  async toggleService(shopId: string, vendorId: string, serviceId: string): Promise<ServiceDto> {
    await this.assertShopOwnership(shopId, vendorId);

    const service = await this.shopRepository.findServiceById(serviceId);
    if (!service || service.shopId.toString() !== shopId || service.status === 'DELETED') {
      throw new NotFoundError('Service not found.');
    }

    const newIsActive = !service.isActive;
    const updated = await this.shopRepository.toggleServiceActive(serviceId, newIsActive);
    if (!updated) throw new NotFoundError('Service not found.');

    this.logger.info({
      action: newIsActive ? 'SERVICE_ENABLED' : 'SERVICE_DISABLED',
      module: 'shop',
      shopId,
      serviceId,
      vendorId,
    });

    return this.toServiceDto(updated);
  }

  async getServicesByIds(ids: string[]): Promise<ServiceDto[]> {
    const services = await this.shopRepository.findServicesByIds(ids);
    return services.map((s) => this.toServiceDto(s));
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
      this.shopRepository.findServicesByShopId(shopId),
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
      const durations = durationMap.get(s._id.toString()) ?? [];
      const minDuration = durations.length > 0 ? Math.min(...durations) : s.baseDurationMinutes;
      const maxDuration = durations.length > 0 ? Math.max(...durations) : s.baseDurationMinutes;
      return {
        id: s._id.toString(),
        categoryId: s.categoryId.toString(),
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

  async searchShops(input: SearchShopsInput): Promise<SearchShopsResponse> {
    const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
    const page = input.page ?? 1;
    const skip = (page - 1) * limit;

    const { shops, total } = await this.shopRepository.searchByName(
      input.query,
      {
        city: input.city,
        shopType: input.shopType,
        minRating: input.minRating,
        serviceName: input.serviceName,
        availableNow: input.availableNow,
        latitude: input.latitude,
        longitude: input.longitude,
        maxDistanceMeters: input.maxDistanceMeters,
      },
      skip,
      limit,
    );

    const shopIds = shops.map((s) => s._id.toString());
    const allServices = await this.shopRepository.findServicesByShopIds(shopIds);

    const servicesByShopId = new Map<string, typeof allServices>();
    for (const svc of allServices) {
      const key = svc.shopId.toString();
      if (!servicesByShopId.has(key)) servicesByShopId.set(key, []);
      servicesByShopId.get(key)!.push(svc);
    }

    const result: ShopSearchResultDto[] = shops.map((s) => {
      const shopId = s._id.toString();
      const shopServices = (servicesByShopId.get(shopId) ?? []).map((svc) => ({
        id: svc._id.toString(),
        name: svc.name,
        basePrice: svc.basePrice,
      }));

      const dto: ShopSearchResultDto = {
        id: shopId,
        name: s.name,
        photos: s.photos ?? [],
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
    const services = await this.shopRepository.findServicesByShopId(shopId);
    return services.map((s) => this.toServiceDto(s));
  }

  async getActiveServicesByIds(serviceIds: string[], shopId: string): Promise<ServiceDto[]> {
    const services = await this.shopRepository.findActiveServicesByIds(serviceIds, shopId);
    return services.map((s) => this.toServiceDto(s));
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
    const services = await this.shopRepository.findServicesByShopIds(shopIds);

    return services.map((s) => ({
      id: s._id.toString(),
      shopId: s.shopId.toString(),
      name: s.name,
      basePrice: s.basePrice,
      baseDurationMinutes: s.baseDurationMinutes,
      description: s.description,
    }));
  }
}
