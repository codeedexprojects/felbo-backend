import { Logger } from 'winston';
import { BarberAvailabilityRepository } from './barberAvailability.repository';
import {
  AvailabilityDto,
  AvailabilityPresetDto,
  BreakPeriod,
  CreatePresetInput,
  SetAvailabilityInput,
} from './barberAvailability.types';
import { IBarberAvailability, IPresetItem } from './barberAvailability.model';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { withTransaction } from '../../shared/database/transaction';
import { BarberService } from '../barber/barber.service';
import ShopService from '../shop/shop.service';
import { getTodayInIst, getCurrentIstDate } from '../../shared/utils/time';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export class BarberAvailabilityService {
  constructor(
    private readonly availabilityRepository: BarberAvailabilityRepository,
    private readonly getBarberService: () => BarberService,
    private readonly getShopService: () => ShopService,
    private readonly logger: Logger,
  ) {}

  private get barberService(): BarberService {
    return this.getBarberService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private getTodayDate(): Date {
    return getTodayInIst();
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private validateBreaksWithinHours(
    breaks: BreakPeriod[],
    workingHours: { start: string; end: string },
  ): void {
    const workStart = this.toMinutes(workingHours.start);
    const workEnd = this.toMinutes(workingHours.end);

    for (const brk of breaks) {
      const breakStart = this.toMinutes(brk.start);
      const breakEnd = this.toMinutes(brk.end);

      if (breakStart >= breakEnd) {
        throw new ValidationError(`Break start (${brk.start}) must be before end (${brk.end}).`);
      }
      if (breakStart < workStart || breakEnd > workEnd) {
        throw new ValidationError(
          `Break ${brk.start}–${brk.end} falls outside working hours ${workingHours.start}–${workingHours.end}.`,
        );
      }
    }
  }

  private validateBreakOverlaps(breaks: BreakPeriod[]): void {
    if (breaks.length < 2) return;

    const sorted = breaks
      .map((b) => ({ start: this.toMinutes(b.start), end: this.toMinutes(b.end) }))
      .sort((a, b) => a.start - b.start);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) {
        throw new ValidationError('Break periods must not overlap.');
      }
    }
  }

  private async validateWithinShopHours(
    shopId: string,
    workingHours: { start: string; end: string },
  ): Promise<void> {
    const shop = await this.shopService.getShopById(shopId);
    const today = getCurrentIstDate();
    const dayName = DAY_NAMES[today.getDay()] as keyof NonNullable<typeof shop.workingHours>;

    if (!shop.workingHours || !shop.workingHours[dayName]) return;

    const dayHours = shop.workingHours[dayName];
    if (!dayHours.isOpen) {
      throw new ValidationError('The shop is closed today. Availability cannot be set.');
    }

    const barberStart = this.toMinutes(workingHours.start);
    const barberEnd = this.toMinutes(workingHours.end);
    const shopOpen = this.toMinutes(dayHours.open);
    const shopClose = this.toMinutes(dayHours.close);

    if (barberStart < shopOpen) {
      throw new ValidationError(
        `Working start time ${workingHours.start} is before shop opening time ${dayHours.open}.`,
      );
    }
    if (barberEnd > shopClose) {
      throw new ValidationError(
        `Working end time ${workingHours.end} is after shop closing time ${dayHours.close}.`,
      );
    }
  }

  private toPresetDto(barberId: string, preset: IPresetItem): AvailabilityPresetDto {
    return {
      id: preset._id.toString(),
      barberId,
      name: preset.name,
      workingHours: preset.workingHours,
      breaks: preset.breaks,
    };
  }

  private toAvailabilityDto(record: IBarberAvailability): AvailabilityDto {
    if (!record.date) {
      throw new Error('toAvailabilityDto called without daily availability set');
    }
    return {
      id: record._id.toString(),
      barberId: record.barberId.toString(),
      shopId: record.shopId.toString(),
      date: `${record.date.getUTCFullYear()}-${String(record.date.getUTCMonth() + 1).padStart(2, '0')}-${String(record.date.getUTCDate()).padStart(2, '0')}`,
      isWorking: record.isWorking ?? false,
      workingHours: record.workingHours,
      breaks: record.breaks,
    };
  }

  async createPreset(barberId: string, input: CreatePresetInput): Promise<AvailabilityPresetDto> {
    const barber = await this.barberService.getBarberById(barberId);
    const breaks = input.breaks ?? [];

    await this.validateWithinShopHours(barber.shopId, input.workingHours);
    this.validateBreaksWithinHours(breaks, input.workingHours);
    this.validateBreakOverlaps(breaks);

    const todayDate = this.getTodayDate();

    const updatedList = await withTransaction(async (session) => {
      const result = await this.availabilityRepository.atomicAddPreset(
        barberId,
        barber.shopId,
        { name: input.name, workingHours: input.workingHours, breaks },
        session,
      );

      if (!result) {
        throw new ConflictError('A barber can have at most 3 availability presets.');
      }

      if (result.presets.length === 1) {
        await this.availabilityRepository.upsertTodayAvailability(
          {
            barberId,
            shopId: barber.shopId,
            date: todayDate,
            isWorking: true,
            workingHours: input.workingHours,
            breaks,
          },
          session,
        );
      }

      return result;
    });

    const added = updatedList.presets[updatedList.presets.length - 1];

    this.logger.info({
      action: 'AVAILABILITY_PRESET_CREATED',
      module: 'barberAvailability',
      barberId,
      presetId: added._id.toString(),
    });

    return this.toPresetDto(barberId, added);
  }

  async listPresets(barberId: string): Promise<AvailabilityPresetDto[]> {
    const presets = await this.availabilityRepository.findPresets(barberId);
    return presets.map((p) => this.toPresetDto(barberId, p));
  }

  async deletePreset(barberId: string, presetId: string): Promise<void> {
    const preset = await this.availabilityRepository.findPresetById(barberId, presetId);
    if (!preset) throw new NotFoundError('Preset not found.');

    await this.availabilityRepository.removePreset(barberId, presetId);

    this.logger.info({
      action: 'AVAILABILITY_PRESET_DELETED',
      module: 'barberAvailability',
      barberId,
      presetId,
    });
  }

  async applyPreset(barberId: string, presetId: string): Promise<AvailabilityDto> {
    const barber = await this.barberService.getBarberById(barberId);
    const preset = await this.availabilityRepository.findPresetById(barberId, presetId);
    if (!preset) throw new NotFoundError('Preset not found.');

    await this.validateWithinShopHours(barber.shopId, preset.workingHours);

    const updated = await this.availabilityRepository.upsertTodayAvailability({
      barberId,
      shopId: barber.shopId,
      date: this.getTodayDate(),
      isWorking: true,
      workingHours: preset.workingHours,
      breaks: preset.breaks,
    });

    this.logger.info({
      action: 'AVAILABILITY_PRESET_APPLIED',
      module: 'barberAvailability',
      barberId,
      presetId,
    });

    return this.toAvailabilityDto(updated!);
  }

  async setTodayAvailability(
    barberId: string,
    input: SetAvailabilityInput,
  ): Promise<AvailabilityDto> {
    const barber = await this.barberService.getBarberById(barberId);
    const breaks = input.breaks ?? [];
    const todayDate = this.getTodayDate();

    if (input.isWorking) {
      if (!input.workingHours) {
        throw new ValidationError('workingHours is required when isWorking is true.');
      }
      await this.validateWithinShopHours(barber.shopId, input.workingHours);
      this.validateBreaksWithinHours(breaks, input.workingHours);
      this.validateBreakOverlaps(breaks);
    }

    const updated = await this.availabilityRepository.upsertTodayAvailability({
      barberId,
      shopId: barber.shopId,
      date: todayDate,
      isWorking: input.isWorking,
      workingHours: input.workingHours,
      breaks,
    });

    this.logger.info({
      action: 'AVAILABILITY_SET',
      module: 'barberAvailability',
      barberId,
      isWorking: input.isWorking,
    });

    return this.toAvailabilityDto(updated!);
  }

  async getTodayAvailability(barberId: string): Promise<AvailabilityDto | null> {
    const record = await this.availabilityRepository.findByBarberId(barberId);

    if (!record || !record.date) return null;
    const todayDate = this.getTodayDate();
    if (record.date.getTime() !== todayDate.getTime()) {
      return null;
    }

    return this.toAvailabilityDto(record);
  }

  async countWorkingByShopIds(shopIds: string[]): Promise<number> {
    const todayDate = this.getTodayDate();
    const nextDay = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
    return this.availabilityRepository.countWorkingByShopIds(shopIds, todayDate, nextDay);
  }

  async getTodayDefault(barberId: string): Promise<Partial<AvailabilityDto>> {
    const barber = await this.barberService.getBarberById(barberId);
    const shop = await this.shopService.getShopById(barber.shopId);

    const today = getCurrentIstDate();
    const dayName = DAY_NAMES[today.getDay()] as keyof NonNullable<typeof shop.workingHours>;

    if (!shop.workingHours || !shop.workingHours[dayName]) {
      return { isWorking: false, breaks: [] };
    }

    const dayHours = shop.workingHours[dayName];
    if (!dayHours.isOpen) {
      return { isWorking: false, breaks: [] };
    }

    return {
      isWorking: true,
      workingHours: { start: dayHours.open, end: dayHours.close },
      breaks: [],
    };
  }
}
