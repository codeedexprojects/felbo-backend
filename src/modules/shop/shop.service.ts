import { ClientSession } from 'mongoose';
import { Logger } from 'winston';
import ShopRepository from './shop.repository';
import { IShop, IEmbeddedCategory, IService, IBarber, IBarberService } from './shop.model';
import {
  CreateShopInput,
  UpdateShopInput,
  UpdateWorkingHoursInput,
  CompleteProfileInput,
  AddCategoryInput,
  AddServiceInput,
  AddBarberInput,
  NearbyShopsInput,
  SearchShopsInput,
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
} from './shop.types';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../../shared/errors/index';
import { withTransaction } from '../../shared/database/transaction';

const DEFAULT_MAX_DISTANCE = 10000; // 10 km
const DEFAULT_PAGE_LIMIT = 20;
const MONGO_DUPLICATE_KEY_CODE = 11000;

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

  private toBarberServiceDto(bs: IBarberService): BarberServiceDto {
    return {
      id: bs._id.toString(),
      serviceId: bs.serviceId.toString(),
      price: bs.price,
      durationMinutes: bs.durationMinutes,
      isActive: bs.isActive,
    };
  }

  private toBarberDto(barber: IBarber, barberServices: IBarberService[]): BarberDto {
    return {
      id: barber._id.toString(),
      shopId: barber.shopId.toString(),
      name: barber.name,
      phone: barber.phone,
      photo: barber.photo,
      rating: barber.rating,
      status: barber.status,
      isActive: barber.isActive,
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

    let service: IService;
    try {
      service = await this.shopRepository.createService({
        shopId,
        categoryId: input.categoryId,
        name: input.name,
        basePrice: input.basePrice,
        baseDurationMinutes: input.baseDurationMinutes,
        applicableFor: input.applicableFor,
        description: input.description,
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: number }).code === MONGO_DUPLICATE_KEY_CODE
      ) {
        throw new ConflictError('A service with this name already exists.');
      }
      throw error;
    }

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

  async addBarber(shopId: string, vendorId: string, input: AddBarberInput): Promise<BarberDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    if (
      shop.onboardingStatus === 'PENDING_PROFILE' ||
      shop.onboardingStatus === 'PENDING_CATEGORIES' ||
      shop.onboardingStatus === 'PENDING_SERVICES'
    ) {
      throw new ConflictError('Add at least one service before adding barbers.');
    }

    // Validate serviceIds
    const serviceIds = input.services.map((s) => s.serviceId);
    const uniqueServiceIds = [...new Set(serviceIds)];
    if (uniqueServiceIds.length !== serviceIds.length) {
      throw new ValidationError('Duplicate service IDs are not allowed.');
    }

    const validServices = await this.shopRepository.findActiveServicesByIds(
      uniqueServiceIds,
      shopId,
    );
    if (validServices.length !== uniqueServiceIds.length) {
      throw new ValidationError(
        'One or more service IDs are invalid or do not belong to this shop.',
      );
    }

    let barber: IBarber;
    let barberServices: IBarberService[];

    try {
      const result = await withTransaction(async (session) => {
        const createdBarber = await this.shopRepository.createBarber(
          {
            shopId,
            vendorId,
            name: input.name,
            phone: input.phone,
            photo: input.photo,
          },
          session,
        );

        const barberServiceData = input.services.map((s) => ({
          barberId: createdBarber._id.toString(),
          serviceId: s.serviceId,
          shopId,
          price: s.price,
          durationMinutes: s.durationMinutes,
        }));

        const createdBarberServices = await this.shopRepository.createBarberServices(
          barberServiceData,
          session,
        );

        // Transition onboarding if this is the first barber
        if (shop.onboardingStatus === 'PENDING_BARBERS') {
          const barberCount = await this.shopRepository.countActiveBarbers(shopId, session);
          if (barberCount === 1) {
            await this.shopRepository.updateOnboardingStatus(shopId, 'COMPLETED', session);
          }
        }

        return { barber: createdBarber, barberServices: createdBarberServices };
      });

      barber = result.barber;
      barberServices = result.barberServices;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: number }).code === MONGO_DUPLICATE_KEY_CODE
      ) {
        throw new ConflictError('A barber with this phone number already exists in this shop.');
      }
      throw error;
    }

    this.logger.info({
      action: 'BARBER_ADDED',
      module: 'shop',
      shopId,
      barberId: barber._id.toString(),
      vendorId,
    });

    return this.toBarberDto(barber, barberServices);
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
      this.shopRepository.findBarbersByShopId(shopId),
      this.shopRepository.findBarberServicesByShopId(shopId),
    ]);

    // Build a map of serviceId → list of barber-specific durations
    const durationMap = new Map<string, number[]>();
    for (const bs of barberServices) {
      const sid = bs.serviceId.toString();
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
      id: b._id.toString(),
      name: b.name,
      photo: b.photo,
      rating: b.rating,
      isAvailableToday: b.isActive,
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

  async getBarbersByShopId(shopId: string): Promise<BarberDto[]> {
    const barbers = await this.shopRepository.findBarbersByShopId(shopId);
    return barbers.map((b) => this.toBarberDto(b, []));
  }

  async getServicesByShopId(shopId: string): Promise<ServiceDto[]> {
    const services = await this.shopRepository.findServicesByShopId(shopId);
    return services.map((s) => this.toServiceDto(s));
  }

  async getBarbersByShopIds(shopIds: string[]): Promise<AdminBarberSummaryDto[]> {
    const barbers = await this.shopRepository.findBarbersByShopIds(shopIds);

    return barbers.map((b) => ({
      id: b._id.toString(),
      name: b.name,
      phone: b.phone,
      photo: b.photo,
      isActive: b.isActive,
      shopId: b.shopId.toString(),
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
