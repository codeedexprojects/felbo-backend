import { ClientSession } from '../../shared/database/transaction';
import { Logger } from 'winston';
import { ServiceRepository } from './service.repository';
import { IBarberService, IService } from './service.model';
import {
  AssignServicesInput,
  BarberAssignedServiceDto,
  BarberServiceLinkDto,
  ServiceDto,
  AddServiceInput,
  UpdateServiceInput,
  AdminServiceSummaryDto,
  BookingServiceSnapshotData,
} from './service.types';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../shared/errors';
import { withTransaction } from '../../shared/database/transaction';
import ShopService from '../shop/shop.service';
import { BarberService } from '../barber/barber.service';
import { CategoryService } from '../category/category.service';

export class ServiceService {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly getShopService: () => ShopService,
    private readonly getBarberService: () => BarberService,
    private readonly getCategoryService: () => CategoryService,
    private readonly logger: Logger,
  ) {}

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private get barberService(): BarberService {
    return this.getBarberService();
  }

  private get categoryService(): CategoryService {
    return this.getCategoryService();
  }

  private toLink(l: IBarberService): BarberServiceLinkDto {
    return {
      id: l._id.toString(),
      barberId: l.barberId.toString(),
      serviceId: l.serviceId.toString(),
      shopId: l.shopId.toString(),
      durationMinutes: l.durationMinutes,
      isActive: l.isActive,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    };
  }

  async assignServices(
    barberId: string,
    vendorId: string,
    input: AssignServicesInput,
  ): Promise<BarberAssignedServiceDto[]> {
    const barber = await this.barberService.getBarber(barberId, vendorId);
    const shopId = barber.shopId;

    const serviceIds = input.services.map((s) => s.serviceId);
    const uniqueServiceIds = [...new Set(serviceIds)];
    if (uniqueServiceIds.length !== serviceIds.length) {
      throw new ValidationError('Duplicate service IDs are not allowed.');
    }

    const validServices = await this.shopService.getActiveServicesByIds(uniqueServiceIds, shopId);
    if (validServices.length !== uniqueServiceIds.length) {
      throw new ValidationError(
        'One or more service IDs are invalid or do not belong to this shop.',
      );
    }

    const newLinks = await withTransaction((session) =>
      this.serviceRepository.replaceBarberServicesForBarber(
        barberId,
        shopId,
        input.services,
        session,
      ),
    );

    this.logger.info({
      action: 'BARBER_SERVICES_ASSIGNED',
      module: 'service',
      barberId,
      vendorId,
      serviceCount: newLinks.length,
    });

    const serviceMap = new Map(
      validServices.map((s) => [s.id, { name: s.name, price: s.basePrice }]),
    );

    return newLinks.map((l) => {
      const serviceInfo = serviceMap.get(l.serviceId.toString());
      return {
        id: l._id.toString(),
        barberId: l.barberId.toString(),
        serviceId: l.serviceId.toString(),
        shopId: l.shopId.toString(),
        serviceName: serviceInfo?.name ?? '',
        price: serviceInfo?.price ?? 0,
        duration: l.durationMinutes,
        isActive: l.isActive,
      };
    });
  }

  async getBarberServices(barberId: string, vendorId: string): Promise<BarberAssignedServiceDto[]> {
    await this.barberService.getBarber(barberId, vendorId);

    const links = await this.serviceRepository.findBarberServicesByBarberIdPopulated(barberId);

    return links.map((l) => ({
      id: l._id.toString(),
      barberId: l.barberId.toString(),
      serviceId: l.serviceId._id.toString(),
      shopId: l.shopId.toString(),
      serviceName: l.serviceId.name,
      price: l.serviceId.basePrice,
      duration: l.durationMinutes,
      isActive: l.isActive,
    }));
  }

  async removeBarberService(barberId: string, serviceId: string, vendorId: string): Promise<void> {
    await this.barberService.getBarber(barberId, vendorId);

    const link = await this.serviceRepository.findBarberServiceByBarberAndServiceId(
      barberId,
      serviceId,
    );
    if (!link) throw new NotFoundError('Service assignment not found.');

    await this.serviceRepository.removeBarberServiceByBarberAndServiceId(barberId, serviceId);

    this.logger.info({
      action: 'BARBER_SERVICE_REMOVED',
      module: 'service',
      barberId,
      serviceId,
      vendorId,
    });
  }

  async hasAnyAssignedService(serviceId: string): Promise<boolean> {
    return this.serviceRepository.existsBarberServiceByServiceId(serviceId);
  }

  createForOnboarding(
    barberId: string,
    shopId: string,
    services: Array<{ serviceId: string; durationMinutes: number }>,
    session?: ClientSession,
  ): Promise<IBarberService[]> {
    return this.serviceRepository.createBarberService(
      services.map((s) => ({ barberId, shopId, ...s })),
      session,
    );
  }

  async getByShopId(shopId: string): Promise<BarberServiceLinkDto[]> {
    const links = await this.serviceRepository.findBarberServicesByShopId(shopId);
    return links.map((l) => this.toLink(l));
  }

  // --- Service Methods ---

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

  async addService(shopId: string, vendorId: string, input: AddServiceInput): Promise<ServiceDto> {
    const shop = await this.shopService.getShopById(shopId);

    if (shop.vendorId !== vendorId) {
      throw new ForbiddenError('You do not own this shop.');
    }
    if (shop.status === 'PENDING_APPROVAL' && shop.onboardingStatus === 'COMPLETED') {
      throw new ForbiddenError('This shop is pending admin approval and cannot be modified.');
    }

    if (shop.onboardingStatus === 'PENDING_PROFILE') {
      throw new ConflictError('Complete your shop profile before adding services.');
    }

    const categoryExists = await this.categoryService.categoryExists(input.categoryId);
    if (!categoryExists) {
      throw new NotFoundError('Category not found.');
    }

    const service = await this.serviceRepository.createService({
      shopId,
      categoryId: input.categoryId,
      name: input.name,
      basePrice: input.basePrice,
      baseDurationMinutes: input.baseDurationMinutes,
      applicableFor: input.applicableFor,
      description: input.description,
    });

    await this.shopService.syncShopCategory(shopId, input.categoryId);

    // Transition onboarding if this is the first service
    if (shop.onboardingStatus === 'PENDING_SERVICES') {
      const count = await this.serviceRepository.countActiveServices(shopId);
      if (count === 1) {
        await this.shopService.updateOnboardingStatus(shopId, 'PENDING_BARBERS');
      }
    }

    this.logger.info({
      action: 'SERVICE_ADDED',
      module: 'service',
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
    const shop = await this.shopService.getShopById(shopId);

    if (shop.vendorId !== vendorId) {
      throw new ForbiddenError('You do not own this shop.');
    }
    if (shop.status === 'PENDING_APPROVAL' && shop.onboardingStatus === 'COMPLETED') {
      throw new ForbiddenError('This shop is pending admin approval and cannot be modified.');
    }

    if (shop.onboardingStatus === 'PENDING_PROFILE') {
      throw new ConflictError('Complete your shop profile before adding services.');
    }

    const categoryExists = await this.categoryService.categoryExists(input.categoryId);
    if (!categoryExists) {
      throw new NotFoundError('Category not found.');
    }

    const currentCount = await this.serviceRepository.countActiveServices(shopId);
    if (currentCount >= 50) {
      // Using 50 directly for now
      throw new ConflictError(`Shop cannot have more than 50 active services.`);
    }

    const service = await this.serviceRepository.createService({
      shopId,
      categoryId: input.categoryId,
      name: input.name,
      basePrice: input.basePrice,
      baseDurationMinutes: input.baseDurationMinutes,
      applicableFor: input.applicableFor,
      description: input.description,
    });

    await this.shopService.syncShopCategory(shopId, input.categoryId);

    this.logger.info({
      action: 'SERVICE_CREATED',
      module: 'service',
      shopId,
      serviceId: service._id.toString(),
      vendorId,
    });

    return this.toServiceDto(service);
  }

  async listServices(shopId: string, vendorId: string): Promise<ServiceDto[]> {
    const shop = await this.shopService.getShopById(shopId);
    if (shop.vendorId !== vendorId) throw new ForbiddenError('You do not own this shop.');

    const services = await this.serviceRepository.findServicesByShopId(shopId);
    return services.map((s) => this.toServiceDto(s));
  }

  async updateService(
    shopId: string,
    vendorId: string,
    serviceId: string,
    input: UpdateServiceInput,
  ): Promise<ServiceDto> {
    const shop = await this.shopService.getShopById(shopId);
    if (shop.vendorId !== vendorId) throw new ForbiddenError('You do not own this shop.');
    if (shop.status === 'PENDING_APPROVAL' && shop.onboardingStatus === 'COMPLETED')
      throw new ForbiddenError('This shop is pending admin approval and cannot be modified.');

    const service = await this.serviceRepository.findServiceById(serviceId);
    if (!service || service.shopId.toString() !== shopId || service.status === 'DELETED') {
      throw new NotFoundError('Service not found.');
    }

    if (input.name && input.name !== service.name) {
      const services = await this.serviceRepository.findServicesByShopId(shopId);
      const duplicate = services.some(
        (s) => s.name === input.name && s._id.toString() !== serviceId,
      );
      if (duplicate) throw new ConflictError('A service with this name already exists.');
    }

    const updated = await this.serviceRepository.updateService(serviceId, input);
    if (!updated) throw new NotFoundError('Service not found.');

    this.logger.info({
      action: 'SERVICE_UPDATED',
      module: 'service',
      shopId,
      serviceId,
      vendorId,
    });

    return this.toServiceDto(updated);
  }

  async deleteService(shopId: string, vendorId: string, serviceId: string): Promise<void> {
    const shop = await this.shopService.getShopById(shopId);
    if (shop.vendorId !== vendorId) throw new ForbiddenError('You do not own this shop.');
    if (shop.status === 'PENDING_APPROVAL' && shop.onboardingStatus === 'COMPLETED')
      throw new ForbiddenError('This shop is pending admin approval and cannot be modified.');

    const service = await this.serviceRepository.findServiceById(serviceId);
    if (!service || service.shopId.toString() !== shopId || service.status === 'DELETED') {
      throw new NotFoundError('Service not found.');
    }

    const hasAssigned = await this.hasAnyAssignedService(serviceId);
    if (hasAssigned) {
      throw new ConflictError('Cannot delete service assigned to barbers.');
    }

    const categoryId = service.categoryId.toString();
    await this.serviceRepository.softDeleteService(serviceId);

    const remainingCount = await this.serviceRepository.countActiveServicesByShopAndCategory(
      shopId,
      categoryId,
    );
    if (remainingCount === 0) {
      await this.shopService.removeCategoryFromShop(shopId, categoryId);
    }

    this.logger.info({
      action: 'SERVICE_DELETED',
      module: 'service',
      shopId,
      serviceId,
      vendorId,
    });
  }

  async toggleService(shopId: string, vendorId: string, serviceId: string): Promise<ServiceDto> {
    const shop = await this.shopService.getShopById(shopId);
    if (shop.vendorId !== vendorId) throw new ForbiddenError('You do not own this shop.');
    if (shop.status === 'PENDING_APPROVAL' && shop.onboardingStatus === 'COMPLETED')
      throw new ForbiddenError('This shop is pending admin approval and cannot be modified.');

    const service = await this.serviceRepository.findServiceById(serviceId);
    if (!service || service.shopId.toString() !== shopId || service.status === 'DELETED') {
      throw new NotFoundError('Service not found.');
    }

    const newIsActive = !service.isActive;
    const updated = await this.serviceRepository.toggleServiceActive(serviceId, newIsActive);
    if (!updated) throw new NotFoundError('Service not found.');

    const categoryId = service.categoryId.toString();
    if (newIsActive) {
      await this.shopService.syncShopCategory(shopId, categoryId);
    } else {
      const remainingCount = await this.serviceRepository.countActiveServicesByShopAndCategory(
        shopId,
        categoryId,
      );
      if (remainingCount === 0) {
        await this.shopService.removeCategoryFromShop(shopId, categoryId);
      }
    }

    this.logger.info({
      action: newIsActive ? 'SERVICE_ENABLED' : 'SERVICE_DISABLED',
      module: 'service',
      shopId,
      serviceId,
      vendorId,
    });

    return this.toServiceDto(updated);
  }

  async getServicesByIds(ids: string[]): Promise<ServiceDto[]> {
    const services = await this.serviceRepository.findServicesByIds(ids);
    return services.map((s) => this.toServiceDto(s));
  }

  async getServicesByShopId(shopId: string): Promise<ServiceDto[]> {
    const services = await this.serviceRepository.findServicesByShopId(shopId);
    return services.map((s) => this.toServiceDto(s));
  }

  async getActiveServicesByIds(serviceIds: string[], shopId: string): Promise<ServiceDto[]> {
    const services = await this.serviceRepository.findActiveServicesByIds(serviceIds, shopId);
    return services.map((s) => this.toServiceDto(s));
  }

  async getServicesByShopIds(shopIds: string[]): Promise<AdminServiceSummaryDto[]> {
    const services = await this.serviceRepository.findServicesByShopIds(shopIds);

    return services.map((s) => ({
      id: s._id.toString(),
      shopId: s.shopId.toString(),
      name: s.name,
      basePrice: s.basePrice,
      baseDurationMinutes: s.baseDurationMinutes,
      description: s.description,
    }));
  }

  async countActiveByCategoryId(categoryId: string): Promise<number> {
    return this.serviceRepository.countActiveByCategoryId(categoryId);
  }

  async getServicesForBookingSnapshot(
    serviceIds: string[],
    shopId: string,
  ): Promise<BookingServiceSnapshotData[]> {
    const services = await this.serviceRepository.findActiveServicesByIds(serviceIds, shopId);

    const categoryIds = [...new Set(services.map((s) => s.categoryId.toString()))];
    const categoryNameMap = await this.categoryService.getCategoryNamesByIds(categoryIds);

    return services.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      categoryName: categoryNameMap.get(s.categoryId.toString()) ?? '',
      basePrice: s.basePrice,
    }));
  }

  async getServicesWithCategories(
    shopId: string,
    shopType?: 'MENS' | 'WOMENS' | 'ALL',
  ): Promise<
    Array<{
      categoryName: string;
      services: Array<{
        id: string;
        name: string;
        durationMinutes: number;
        price: number;
        isAvailable: boolean;
      }>;
    }>
  > {
    const [categoriesWithServices, availableServiceIds] = await Promise.all([
      this.serviceRepository.findServicesByCategoryForShop(shopId, shopType),
      this.barberService.getAvailableServiceIds(shopId),
    ]);

    return categoriesWithServices.map((cat) => ({
      categoryName: cat.name,
      services: cat.services.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        durationMinutes: s.baseDurationMinutes,
        price: s.basePrice,
        isAvailable: availableServiceIds.has(s._id.toString()),
      })),
    }));
  }

  async countServicesByShopIds(shopIds: string[]): Promise<Map<string, number>> {
    return this.serviceRepository.countServicesByShopIds(shopIds);
  }
}
