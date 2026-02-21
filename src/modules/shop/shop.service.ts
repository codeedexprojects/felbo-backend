import { ClientSession } from 'mongoose';
import { Logger } from 'winston';
import ShopRepository from './shop.repository';
import { IShop, IService, IBarber, IBarberService } from './shop.model';
import {
  CreateShopInput,
  UpdateShopInput,
  UpdateWorkingHoursInput,
  CompleteProfileInput,
  AddServiceInput,
  AddBarberInput,
  NearbyShopsInput,
  SearchShopsInput,
  ShopDto,
  NearbyShopDto,
  ServiceDto,
  BarberDto,
  BarberServiceDto,
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

  private toServiceDto(service: IService): ServiceDto {
    return {
      id: service._id.toString(),
      shopId: service.shopId.toString(),
      name: service.name,
      basePrice: service.basePrice,
      baseDuration: service.baseDuration,
      description: service.description,
      isActive: service.isActive,
    };
  }

  private toBarberServiceDto(bs: IBarberService): BarberServiceDto {
    return {
      id: bs._id.toString(),
      serviceId: bs.serviceId.toString(),
      price: bs.price,
      duration: bs.duration,
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

  // --- Onboarding ---

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

  async addService(shopId: string, vendorId: string, input: AddServiceInput): Promise<ServiceDto> {
    const shop = await this.assertShopOwnership(shopId, vendorId);

    if (shop.onboardingStatus === 'PENDING_PROFILE') {
      throw new ConflictError('Complete your shop profile before adding services.');
    }

    let service: IService;
    try {
      service = await this.shopRepository.createService({
        shopId,
        name: input.name,
        basePrice: input.basePrice,
        baseDuration: input.baseDuration,
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
          duration: s.duration,
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
