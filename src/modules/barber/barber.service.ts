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
  AddBarberServicesInput,
  AddBarberServicesDto,
  AddBarberServiceItemDto,
  BarberServiceLinkDto,
  BarberSendOtpInput,
  BarberSendOtpResult,
  BarberVerifyOtpInput,
  BarberVerifyOtpResult,
  BarberSetPasswordInput,
  BarberAuthResult,
  BarberLoginInput,
  AddSelfAsBarberInput,
  SelfBarberDto,
  CreateSlotBlockInput,
  SlotBlockResult,
  ReleaseSlotBlockInput,
  ListSlotBlocksQuery,
} from './barber.types';
import { IBarber, ISlotBlock } from './barber.model';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
} from '../../shared/errors';
import { hashPassword, comparePassword } from '../../shared/utils/password';
import { withTransaction } from '../../shared/database/transaction';
import { Logger } from 'winston';
import ShopService from '../shop/shop.service';
import { BarberEmailOtpService } from '../../shared/services/brevo-email-otp.service';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';
import { ClientSession } from 'mongoose';
import crypto from 'crypto';
import { getRedisClient } from '../../shared/redis/redis';

interface TodayAvailabilityData {
  isWorking?: boolean;
  workingHours?: { start: string; end: string };
  breaks: Array<{ start: string; end: string }>;
}

export class BarberService {
  private availabilityService?: {
    getTodayAvailability(barberId: string): Promise<TodayAvailabilityData | null>;
  };

  constructor(
    private readonly barberRepository: BarberRepository,
    private readonly getShopService: () => ShopService,
    private readonly logger: Logger,
    private readonly emailOtpService: BarberEmailOtpService,
    private readonly jwtService: JwtService,
  ) {}

  setAvailabilityService(svc: {
    getTodayAvailability(barberId: string): Promise<TodayAvailabilityData | null>;
  }): void {
    this.availabilityService = svc;
  }

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

    const barber = await this.barberRepository.create({
      shopId: input.shopId,
      vendorId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      photo: input.photo,
    });

    return this.toDto(barber);
  }

  async getBarber(barberId: string, vendorId: string): Promise<BarberManagementDto> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
    if (barber.vendorId.toString() !== vendorId) throw new ForbiddenError('Access denied.');
    return this.toDto(barber);
  }

  async getBarberById(barberId: string): Promise<BarberManagementDto> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
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

    const updated = await this.barberRepository.updateById(barberId, input);
    if (!updated) throw new NotFoundError('Barber not found.');
    return this.toDto(updated);
  }

  async deleteBarber(barberId: string, vendorId: string): Promise<void> {
    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') throw new NotFoundError('Barber not found.');
    if (barber.vendorId.toString() !== vendorId) throw new ForbiddenError('Access denied.');

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

    const barber = await this.barberRepository.createBarber({
      shopId,
      vendorId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      photo: input.photo,
    });

    if (shop.onboardingStatus === 'PENDING_BARBERS') {
      await this.shopService.updateOnboardingStatus(shopId, 'PENDING_BARBER_SERVICES');
    }

    this.logger.info({
      action: 'BARBER_ADDED',
      module: 'barber',
      shopId,
      barberId: barber._id.toString(),
      vendorId,
    });

    return {
      id: barber._id.toString(),
      shopId: barber.shopId.toString(),
      name: barber.name,
      phone: barber.phone,
      email: barber.email,
      photo: barber.photo,
      rating: barber.rating,
      status: barber.status,
      isAvailable: barber.isAvailable,
    };
  }

  async addBarberServices(
    shopId: string,
    barberId: string,
    vendorId: string,
    input: AddBarberServicesInput,
  ): Promise<AddBarberServicesDto> {
    const shop = await this.shopService.getShopById(shopId);

    if (shop.vendorId !== vendorId) {
      throw new ForbiddenError('You do not own this shop.');
    }

    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') {
      throw new NotFoundError('Barber not found.');
    }
    if (barber.shopId.toString() !== shopId) {
      throw new ForbiddenError('Barber does not belong to this shop.');
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

    const barberServiceData = input.services.map((s) => ({
      barberId,
      serviceId: s.serviceId,
      shopId,
      durationMinutes: s.durationMinutes,
    }));

    const createdBarberServices = await withTransaction(async (session) => {
      const created = await this.barberRepository.createBarberServices(barberServiceData, session);

      if (shop.onboardingStatus === 'PENDING_BARBER_SERVICES') {
        await this.shopService.updateOnboardingStatus(shopId, 'COMPLETED', session);
      }

      return created;
    });

    this.logger.info({
      action: 'BARBER_SERVICES_ASSIGNED',
      module: 'barber',
      shopId,
      barberId,
      vendorId,
      serviceCount: createdBarberServices.length,
    });

    const serviceNameMap = new Map(validServices.map((s) => [s.id, s.name]));

    const services: AddBarberServiceItemDto[] = createdBarberServices.map((bs) => ({
      id: bs._id.toString(),
      serviceId: bs.serviceId.toString(),
      serviceName: serviceNameMap.get(bs.serviceId.toString()) ?? '',
      durationMinutes: bs.durationMinutes,
      isActive: bs.isActive,
    }));

    return { barberId, services };
  }

  async sendOtp(input: BarberSendOtpInput): Promise<BarberSendOtpResult> {
    const barber = await this.barberRepository.findByEmail(input.email);

    if (!barber) {
      throw new NotFoundError('No barber account found with this email.');
    }

    if (barber.status === 'INACTIVE') {
      throw new ForbiddenError(
        'Your account has not been activated yet. Please contact your vendor.',
      );
    }

    const result = await this.emailOtpService.sendOtp(input.email, input.clientIp);

    this.logger.info({
      action: 'BARBER_OTP_SENT',
      module: 'barber',
      barberId: barber._id.toString(),
      email: input.email.slice(-8),
    });

    return { message: result.message };
  }

  async verifyOtp(input: BarberVerifyOtpInput): Promise<BarberVerifyOtpResult> {
    const barber = await this.barberRepository.findByEmail(input.email);

    if (!barber) {
      throw new NotFoundError('No barber account found with this email.');
    }

    if (barber.status === 'INACTIVE') {
      throw new ForbiddenError('Your account has not been activated yet.');
    }

    const result = await this.emailOtpService.verifyOtp(input.email, input.otp);
    if (!result.verified) {
      throw new UnauthorizedError('Invalid OTP. Please try again.');
    }

    const redis = getRedisClient();
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await redis.set(`barber-reset:${tokenHash}`, barber._id.toString(), { EX: 600 });

    this.logger.info({
      action: 'BARBER_OTP_VERIFIED',
      module: 'barber',
      barberId: barber._id.toString(),
      email: input.email.slice(-8),
    });

    return { resetToken, message: 'OTP verified. Please set your new password.' };
  }

  async setPassword(input: BarberSetPasswordInput): Promise<BarberAuthResult> {
    const redis = getRedisClient();
    const tokenHash = crypto.createHash('sha256').update(input.resetToken).digest('hex');
    const resetKey = `barber-reset:${tokenHash}`;
    const barberId = await redis.get(resetKey);

    if (!barberId) {
      throw new UnauthorizedError(
        'Reset token has expired or is invalid. Please request a new OTP.',
      );
    }

    const barber = await this.barberRepository.findById(barberId);
    if (!barber || barber.status === 'DELETED') {
      throw new NotFoundError('Barber not found.');
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.barberRepository.setPassword(barberId, passwordHash);

    await redis.del(resetKey);

    const tokenPayload: TokenPayload = {
      sub: barberId,
      role: 'BARBER',
    };
    const token = this.jwtService.signToken(tokenPayload);
    const refreshToken = this.jwtService.signRefreshToken(tokenPayload);
    const refreshTokenHash = this.jwtService.hashToken(refreshToken);
    await this.barberRepository.updateRefreshToken(barberId, refreshTokenHash);

    this.logger.info({
      action: 'BARBER_PASSWORD_SET',
      module: 'barber',
      barberId,
    });

    return {
      token,
      refreshToken,
      barber: {
        id: barber._id.toString(),
        name: barber.name,
        email: barber.email!,
        shopId: barber.shopId.toString(),
        status: barber.status,
      },
    };
  }

  async login(input: BarberLoginInput): Promise<BarberAuthResult> {
    const barber = await this.barberRepository.findByEmailWithPassword(input.email);

    if (!barber || barber.status === 'INACTIVE') {
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (!barber.passwordHash) {
      throw new ForbiddenError(
        'Account setup not complete. Please use the OTP flow to set a password.',
      );
    }

    const isValid = await comparePassword(input.password, barber.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const tokenPayload: TokenPayload = {
      sub: barber._id.toString(),
      role: 'BARBER',
    };
    const token = this.jwtService.signToken(tokenPayload);
    const refreshToken = this.jwtService.signRefreshToken(tokenPayload);
    const refreshTokenHash = this.jwtService.hashToken(refreshToken);
    await this.barberRepository.updateRefreshToken(barber._id.toString(), refreshTokenHash);

    this.logger.info({
      action: 'BARBER_LOGIN',
      module: 'barber',
      barberId: barber._id.toString(),
      email: input.email.slice(-8),
    });

    return {
      token,
      refreshToken,
      barber: {
        id: barber._id.toString(),
        name: barber.name,
        email: barber.email!,
        shopId: barber.shopId.toString(),
        status: barber.status,
      },
    };
  }

  async createSlotBlock(input: CreateSlotBlockInput): Promise<SlotBlockResult> {
    const barber = await this.barberRepository.findById(input.barberId);
    if (!barber || barber.status === 'DELETED') {
      throw new NotFoundError('Barber not found.');
    }

    if (barber.status === 'INACTIVE') {
      throw new ForbiddenError('Your account is inactive and cannot accept walk-in customers.');
    }

    if (!barber.isAvailable) {
      throw new ConflictError('You are currently marked as unavailable.');
    }

    const shopId = barber.shopId.toString();

    const uniqueServiceIds = input.serviceIds ? [...new Set(input.serviceIds)] : undefined;

    const serviceDurationMinutes = await this.resolveServiceDuration(
      input.barberId,
      uniqueServiceIds,
    );

    const totalDurationMinutes = serviceDurationMinutes + 5;

    const now = new Date();
    const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const endTimeObj = new Date(now.getTime() + totalDurationMinutes * 60_000);
    const endTime = `${endTimeObj.getHours().toString().padStart(2, '0')}:${endTimeObj.getMinutes().toString().padStart(2, '0')}`;

    if (endTime <= startTime) {
      throw new ValidationError(
        'Walk-in booking cannot extend past midnight. Please try again earlier.',
      );
    }

    const todayAvailability =
      (await this.availabilityService?.getTodayAvailability(input.barberId)) ?? null;

    if (todayAvailability) {
      if (!todayAvailability.isWorking) {
        throw new ConflictError('You are not scheduled to work today.');
      }

      if (todayAvailability.workingHours) {
        const { start: workStart, end: workEnd } = todayAvailability.workingHours;
        if (startTime < workStart || endTime > workEnd) {
          throw new ConflictError(
            `Walk-in slot (${this.formatTime(startTime)}–${this.formatTime(endTime)}) is outside your working hours (${this.formatTime(workStart)}–${this.formatTime(workEnd)}).`,
          );
        }
      }

      for (const brk of todayAvailability.breaks ?? []) {
        if (startTime < brk.end && endTime > brk.start) {
          throw new ConflictError(
            `Walk-in slot overlaps with your break (${this.formatTime(brk.start)}–${this.formatTime(brk.end)}).`,
          );
        }
      }
    }

    const overlapping = await this.barberRepository.findOverlappingActiveBlocks(
      input.barberId,
      now,
      startTime,
      endTime,
    );
    if (overlapping.length > 0) {
      throw new ConflictError(
        `You already have an active block from ${this.formatTime(startTime)} to ${this.formatTime(endTime)}. Please release it first.`,
      );
    }

    const blockDate = new Date(now);
    blockDate.setHours(0, 0, 0, 0);

    const slotBlock = await this.barberRepository.createSlotBlock({
      shopId,
      barberId: input.barberId,
      serviceIds: uniqueServiceIds,
      createdBy: input.barberId,
      date: blockDate,
      startTime,
      endTime,
      durationMinutes: totalDurationMinutes,
      reason: input.reason,
      status: 'ACTIVE',
    });

    this.logger.info({
      action: 'SLOT_BLOCK_CREATED',
      module: 'barber',
      barberId: input.barberId,
      shopId,
      blockId: slotBlock._id.toString(),
    });

    return this.toSlotBlockDto(slotBlock);
  }

  private async resolveServiceDuration(
    barberId: string,
    serviceIds: string[] | undefined,
  ): Promise<number> {
    const FALLBACK_DURATION_MINUTES = 30;

    if (!serviceIds || serviceIds.length === 0) {
      return FALLBACK_DURATION_MINUTES;
    }

    const allBarberServices = await this.barberRepository.findBarberServicesByBarberId(barberId);
    const serviceMap = new Map(allBarberServices.map((s) => [s.serviceId.toString(), s]));

    let total = 0;
    for (const serviceId of serviceIds) {
      const barberService = serviceMap.get(serviceId);
      if (!barberService || !barberService.isActive) {
        throw new NotFoundError(`Service ${serviceId} is not available for this barber.`);
      }
      total += barberService.durationMinutes;
    }

    return total;
  }

  async releaseSlotBlock(input: ReleaseSlotBlockInput): Promise<SlotBlockResult> {
    const block = await this.barberRepository.findSlotBlockById(input.blockId);
    if (!block) {
      throw new NotFoundError('Slot block not found.');
    }

    if (block.barberId.toString() !== input.barberId) {
      throw new ForbiddenError('Not authorized to release this slot block.');
    }

    if (block.status !== 'ACTIVE') {
      throw new ValidationError('Slot block is already released.');
    }

    const releasedBlock = await this.barberRepository.releaseSlotBlock(input.blockId);
    if (!releasedBlock) {
      throw new NotFoundError('Slot block could not be released. It may have been deleted.');
    }

    this.logger.info({
      action: 'SLOT_BLOCK_RELEASED',
      module: 'barber',
      barberId: input.barberId,
      shopId: block.shopId.toString(),
      blockId: input.blockId,
    });

    return this.toSlotBlockDto(releasedBlock);
  }

  async listSlotBlocks(barberId: string, query: ListSlotBlocksQuery): Promise<SlotBlockResult[]> {
    const date = query.date ? new Date(query.date) : new Date();
    const blocks = await this.barberRepository.listSlotBlocks(barberId, date, query.status);
    return blocks.map((b) => this.toSlotBlockDto(b));
  }

  async activateBarbersByVendorId(vendorId: string, session?: ClientSession): Promise<void> {
    await this.barberRepository.activateBarbersByVendorId(vendorId, session);

    this.logger.info({
      action: 'BARBERS_ACTIVATED',
      module: 'barber',
      vendorId,
    });
  }

  private toDto(barber: IBarber): BarberManagementDto {
    return {
      id: barber._id.toString(),
      shopId: barber.shopId.toString(),
      vendorId: barber.vendorId.toString(),
      name: barber.name,
      phone: barber.phone,
      email: barber.email,
      photo: barber.photo,
      username: barber.username ?? '',
      rating: barber.rating,
      status: barber.status,
      isAvailable: barber.isAvailable,
      createdAt: barber.createdAt,
      updatedAt: barber.updatedAt,
    };
  }

  async getVendorBarberProfile(vendorId: string): Promise<SelfBarberDto | null> {
    const barber = await this.barberRepository.findVendorBarberProfile(vendorId);
    if (!barber) return null;
    return {
      id: barber._id.toString(),
      shopId: barber.shopId.toString(),
      name: barber.name,
      phone: barber.phone,
      photo: barber.photo,
      isAvailable: barber.isAvailable,
    };
  }

  async addSelfAsBarber(
    shopId: string,
    vendorId: string,
    input: AddSelfAsBarberInput,
  ): Promise<SelfBarberDto> {
    const shop = await this.shopService.getShopById(shopId);
    if (shop.vendorId !== vendorId) {
      throw new ForbiddenError('You do not own this shop.');
    }

    const existing = await this.barberRepository.findVendorBarberProfile(vendorId);
    if (existing) {
      throw new ConflictError('You already have a barber profile.');
    }

    const barber = await this.barberRepository.createBarber({
      shopId,
      vendorId,
      email: input.email,
      name: input.name,
      phone: input.phone,
      photo: input.photo,
      isVendorBarber: true,
    });

    this.logger.info({
      action: 'VENDOR_ADDED_SELF_AS_BARBER',
      module: 'barber',
      shopId,
      barberId: barber._id.toString(),
      vendorId,
    });

    return {
      id: barber._id.toString(),
      shopId: barber.shopId.toString(),
      name: barber.name,
      phone: barber.phone,
      photo: barber.photo,
      isAvailable: barber.isAvailable,
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

  private formatTime(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
  }

  private toSlotBlockDto(block: ISlotBlock): SlotBlockResult {
    return {
      id: block._id.toString(),
      barberId: block.barberId.toString(),
      shopId: block.shopId.toString(),
      startTime: block.startTime,
      endTime: block.endTime,
      durationMinutes: block.durationMinutes,
      status: block.status,
    };
  }
}
