import { BarberRepository } from './barber.repository';
import {
  CreateBarberInput,
  UpdateBarberInput,
  UpdateBarberCredentialsInput,
  BarberManagementDto,
  ListBarbersResponse,
  ListBarbersFilter,
  OnboardBarberInput,
  OnboardBarberDto,
  OnboardBarberServiceDto,
  BarberServiceLinkDto,
} from './barber.types';
import { IBarber } from './barber.model';
import { IBarberService } from '../service/service.model';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../shared/errors';
import { hashPassword } from '../../shared/utils/password';
import { withTransaction } from '../../shared/database/transaction';
import { Logger } from 'winston';
import ShopService from '../shop/shop.service';

export class BarberService {
  constructor(
    private readonly barberRepository: BarberRepository,
    private readonly getShopService: () => ShopService,
    private readonly logger: Logger,
  ) {}

  private get shopService(): ShopService {
    return this.getShopService();
  }

  async listBarbers(
    shopId: string,
    vendorId: string,
    filter: ListBarbersFilter,
  ): Promise<ListBarbersResponse> {
    const shop = await this.shopService.getShopById(shopId);
    if (shop.vendorId !== vendorId)
      throw new ForbiddenError('You do not have access to this shop.');

    const { barbers, total } = await this.barberRepository.findByShopId(shopId, filter);
    return {
      barbers: barbers.map((b) => this.toDto(b)),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  async createBarber(input: CreateBarberInput, vendorId: string): Promise<BarberManagementDto> {
    const shop = await this.shopService.getShopById(input.shopId);
    if (shop.vendorId !== vendorId)
      throw new ForbiddenError('You do not have access to this shop.');

    const [existingUsername, existingPhone] = await Promise.all([
      this.barberRepository.findByUsername(input.username),
      this.barberRepository.findByPhone(input.shopId, input.phone),
    ]);

    if (existingUsername) throw new ConflictError('Username is already taken.');
    if (existingPhone)
      throw new ConflictError('A barber with this phone already exists in this shop.');

    const passwordHash = await hashPassword(input.password);

    const barber = await this.barberRepository.create({
      shopId: input.shopId,
      vendorId,
      name: input.name,
      phone: input.phone,
      photo: input.photo,
      username: input.username,
      passwordHash,
    });

    return this.toDto(barber);
  }

  async getBarber(barberId: string, vendorId: string): Promise<BarberManagementDto> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
    if (barber.vendorId.toString() !== vendorId) throw new ForbiddenError('Access denied.');
    return this.toDto(barber);
  }

  async updateBarber(
    barberId: string,
    input: UpdateBarberInput,
    vendorId: string,
  ): Promise<BarberManagementDto> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
    if (barber.vendorId.toString() !== vendorId) throw new ForbiddenError('Access denied.');

    if (input.phone && input.phone !== barber.phone) {
      const existing = await this.barberRepository.findByPhone(
        barber.shopId.toString(),
        input.phone,
      );
      if (existing)
        throw new ConflictError('A barber with this phone already exists in this shop.');
    }

    const updated = await this.barberRepository.updateById(barberId, input);
    if (!updated) throw new NotFoundError('Barber not found.');
    return this.toDto(updated);
  }

  async deleteBarber(barberId: string, vendorId: string): Promise<void> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
    if (barber.vendorId.toString() !== vendorId) throw new ForbiddenError('Access denied.');

    // TODO: Check for future bookings when booking module is implemented.
    // if (await this.bookingRepository.hasFutureBookings(barberId)) {
    //   throw new ConflictError('Cannot delete barber with upcoming bookings.');
    // }

    await this.barberRepository.softDelete(barberId);
  }

  async toggleBarberAvailability(barberId: string, vendorId: string): Promise<BarberManagementDto> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
    if (barber.vendorId.toString() !== vendorId) throw new ForbiddenError('Access denied.');

    const newAvailability = !barber.isAvailable;
    const updated = await this.barberRepository.updateAvailability(barberId, newAvailability);
    return this.toDto(updated!);
  }

  async updateCredentials(
    barberId: string,
    input: UpdateBarberCredentialsInput,
    vendorId: string,
  ): Promise<void> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
    if (barber.vendorId.toString() !== vendorId) throw new ForbiddenError('Access denied.');

    const update: { username?: string; passwordHash?: string } = {};

    if (input.username) {
      if (input.username !== barber.username) {
        const existing = await this.barberRepository.findByUsername(input.username);
        if (existing) throw new ConflictError('Username is already taken.');
      }
      update.username = input.username;
    }

    if (input.password) {
      update.passwordHash = await hashPassword(input.password);
    }

    await this.barberRepository.updateCredentials(barberId, update);
  }

  async addBarber(
    shopId: string,
    vendorId: string,
    input: OnboardBarberInput,
  ): Promise<OnboardBarberDto> {
    const shop = await this.shopService.getShopById(shopId);

    if (shop.vendorId !== vendorId) {
      throw new ForbiddenError('You do not own this shop.');
    }

    if (
      shop.onboardingStatus === 'PENDING_PROFILE' ||
      shop.onboardingStatus === 'PENDING_SERVICES'
    ) {
      throw new ConflictError('Add at least one service before adding barbers.');
    }

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

    const result = await withTransaction(async (session) => {
      const createdBarber = await this.barberRepository.createBarber(
        { shopId, vendorId, name: input.name, phone: input.phone, photo: input.photo },
        session,
      );

      const barberServiceData = input.services.map((s) => ({
        barberId: createdBarber._id.toString(),
        serviceId: s.serviceId,
        shopId,
        durationMinutes: s.durationMinutes,
      }));

      const createdBarberServices = await this.barberRepository.createBarberServices(
        barberServiceData,
        session,
      );

      if (shop.onboardingStatus === 'PENDING_BARBERS') {
        const barberCount = await this.barberRepository.countActiveBarbers(shopId, session);
        if (barberCount === 1) {
          await this.shopService.updateOnboardingStatus(shopId, 'COMPLETED', session);
        }
      }

      return { barber: createdBarber, barberServices: createdBarberServices };
    });

    this.logger.info({
      action: 'BARBER_ADDED',
      module: 'barber',
      shopId,
      barberId: result.barber._id.toString(),
      vendorId,
    });

    return this.toOnboardDto(result.barber, result.barberServices);
  }

  private toOnboardDto(barber: IBarber, barberServices: IBarberService[]): OnboardBarberDto {
    const services: OnboardBarberServiceDto[] = barberServices.map((bs) => ({
      id: bs._id.toString(),
      serviceId: bs.serviceId.toString(),
      durationMinutes: bs.durationMinutes,
      isActive: bs.isActive,
    }));

    return {
      id: barber._id.toString(),
      shopId: barber.shopId.toString(),
      name: barber.name,
      phone: barber.phone,
      photo: barber.photo,
      rating: barber.rating,
      status: barber.status,
      isAvailable: barber.isAvailable,
      services,
    };
  }

  private toDto(barber: IBarber): BarberManagementDto {
    return {
      id: barber._id.toString(),
      shopId: barber.shopId.toString(),
      vendorId: barber.vendorId.toString(),
      name: barber.name,
      phone: barber.phone,
      photo: barber.photo,
      username: barber.username ?? '',
      rating: barber.rating,
      status: barber.status,
      isAvailable: barber.isAvailable,
      createdAt: barber.createdAt,
      updatedAt: barber.updatedAt,
    };
  }

  async getBarbersByShopId(shopId: string): Promise<BarberManagementDto[]> {
    const barbers = await this.barberRepository.findAllActiveByShopId(shopId);
    return barbers.map((b) => this.toDto(b));
  }

  async getBarbersByShopIds(shopIds: string[]): Promise<BarberManagementDto[]> {
    const barbers = await this.barberRepository.findBarbersByShopIds(shopIds);
    return barbers.map((b) => this.toDto(b as IBarber));
  }

  async getBarberServicesByShopId(shopId: string): Promise<BarberServiceLinkDto[]> {
    const links = await this.barberRepository.findBarberServicesByShopId(shopId);
    return links.map((l) => ({
      id: l._id.toString(),
      barberId: l.barberId.toString(),
      serviceId: l.serviceId.toString(),
      shopId: l.shopId.toString(),
      durationMinutes: l.durationMinutes,
      isActive: l.isActive,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
  }
}
