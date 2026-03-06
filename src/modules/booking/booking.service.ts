import { Logger } from 'winston';
import { BookingRepository } from './booking.repository';
import { GetSlotsInput, GetSlotsResponse, TimeSlot, BlockedRange } from './booking.types';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { getTodayInIst, getCurrentIstMinutes, parseDateAsIst } from '../../shared/utils/time';
import { BarberService } from '../barber/barber.service';
import { BarberAvailabilityService } from '../barberAvailability/barberAvailability.service';
import ShopService from '../shop/shop.service';

// System config defaults — replace with configService when available
const SLOT_INTERVAL_MINUTES = 15;
const MIN_BUFFER_MINUTES = 30;
const APPOINTMENT_BUFFER_MINUTES = 5;

export class BookingService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly getBarberService: () => BarberService,
    private readonly getAvailabilityService: () => BarberAvailabilityService,
    private readonly getShopService: () => ShopService,
    private readonly logger: Logger,
  ) {}

  private get barberService(): BarberService {
    return this.getBarberService();
  }

  private get availabilityService(): BarberAvailabilityService {
    return this.getAvailabilityService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  async getSlots(input: GetSlotsInput): Promise<GetSlotsResponse> {
    // Validate date is today (same-day only)
    const requestedDate = parseDateAsIst(input.date);
    const todayUtc = getTodayInIst();

    if (requestedDate.getTime() !== todayUtc.getTime()) {
      throw new ValidationError('Bookings are only available for today.');
    }

    // Validate shop
    const shop = await this.shopService.getShopById(input.shopId);
    if (shop.status !== 'ACTIVE') {
      throw new NotFoundError('Shop not found or not active.');
    }

    // Validate barber (also confirms it exists and is active)
    const barber = await this.barberService.getBarberById(input.barberId);
    if (barber.shopId !== input.shopId) {
      throw new ValidationError('Barber does not belong to this shop.');
    }
    if (!barber.isAvailable) {
      return this.emptyResponse(input, barber.name, 0);
    }

    // Validate services and get durations — Step 6 of calc: gather service durations
    const barberServiceLinks = await this.barberService.getBarberServicesByBarberId(input.barberId);
    const barberServiceMap = new Map(
      barberServiceLinks.map((l) => [l.serviceId, l.durationMinutes]),
    );

    let totalDurationMinutes = 0;
    for (const serviceId of input.serviceIds) {
      const duration = barberServiceMap.get(serviceId);
      if (duration === undefined) {
        throw new ValidationError('One or more services are not offered by this barber.');
      }
      totalDurationMinutes += duration;
    }

    // Step 1: Get barber schedule
    const availability = await this.availabilityService.getTodayAvailability(input.barberId);

    // Step 2: Stop if not working
    if (!availability || !availability.isWorking || !availability.workingHours) {
      return this.emptyResponse(input, barber.name, totalDurationMinutes);
    }

    const workingHours = availability.workingHours;
    const breaks = availability.breaks ?? [];

    // Step 3: Confirmed bookings
    const confirmedBookings = await this.bookingRepository.findConfirmedBookingsByBarberAndDate(
      input.barberId,
      requestedDate,
    );

    // Step 4: Walk-in blocks (slotBlocks)
    const slotBlocks = await this.bookingRepository.findActiveSlotBlocksByBarberAndDate(
      input.barberId,
      requestedDate,
    );

    // Step 5: Payment locks (slotLocks)
    const slotLocks = await this.bookingRepository.findActiveSlotLocksByBarberAndDate(
      input.barberId,
      requestedDate,
    );

    // Step 6: Collect all blocked ranges
    const bookedRanges: BlockedRange[] = confirmedBookings.map((b) => ({
      startMinutes: this.toMinutes(b.startTime),
      // Extend by appointment buffer to enforce gap between appointments
      endMinutes: this.toMinutes(b.endTime) + APPOINTMENT_BUFFER_MINUTES,
    }));

    const blockedRanges: BlockedRange[] = slotBlocks.map((b) => ({
      startMinutes: this.toMinutes(b.startTime),
      endMinutes: this.toMinutes(b.endTime),
    }));

    const lockedRanges: BlockedRange[] = slotLocks.map((l) => ({
      startMinutes: this.toMinutes(l.startTime),
      endMinutes: this.toMinutes(l.endTime),
    }));

    const breakRanges: BlockedRange[] = breaks.map((b) => ({
      startMinutes: this.toMinutes(b.start),
      endMinutes: this.toMinutes(b.end),
    }));

    // Step 7 & 8: Generate 15-min intervals, filter <30m buffer
    const workStart = this.toMinutes(workingHours.start);
    const workEnd = this.toMinutes(workingHours.end);

    const nowMinutesUtc = getCurrentIstMinutes();
    const earliestBookable = nowMinutesUtc + MIN_BUFFER_MINUTES;

    // Step 9: Build and return slot list
    const slots = this.generateSlots({
      workStart,
      workEnd,
      totalDurationMinutes,
      earliestBookable,
      breakRanges,
      bookedRanges,
      blockedRanges,
      lockedRanges,
    });

    this.logger.info({
      action: 'SLOTS_GENERATED',
      module: 'booking',
      shopId: input.shopId,
      barberId: input.barberId,
      date: input.date,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.available).length,
    });

    return {
      shopId: input.shopId,
      date: input.date,
      barberId: input.barberId,
      barberName: barber.name,
      totalDurationMinutes,
      slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
      workingHours,
      slots,
    };
  }

  private generateSlots(params: {
    workStart: number;
    workEnd: number;
    totalDurationMinutes: number;
    earliestBookable: number;
    breakRanges: BlockedRange[];
    bookedRanges: BlockedRange[];
    blockedRanges: BlockedRange[];
    lockedRanges: BlockedRange[];
  }): TimeSlot[] {
    const {
      workStart,
      workEnd,
      totalDurationMinutes,
      earliestBookable,
      breakRanges,
      bookedRanges,
      blockedRanges,
      lockedRanges,
    } = params;

    const slots: TimeSlot[] = [];

    for (
      let slotStart = workStart;
      slotStart + totalDurationMinutes <= workEnd;
      slotStart += SLOT_INTERVAL_MINUTES
    ) {
      const slotEnd = slotStart + totalDurationMinutes;
      const timeStr = this.fromMinutes(slotStart);

      // Filter: slot starts before minimum buffer window
      if (slotStart < earliestBookable) {
        slots.push({ time: timeStr, available: false, reason: 'passed' });
        continue;
      }

      // Check break overlap
      const breakConflict = breakRanges.some(
        (r) => slotStart < r.endMinutes && slotEnd > r.startMinutes,
      );
      if (breakConflict) {
        slots.push({ time: timeStr, available: false, reason: 'break' });
        continue;
      }

      // Check confirmed booking overlap
      const bookedConflict = bookedRanges.some(
        (r) => slotStart < r.endMinutes && slotEnd > r.startMinutes,
      );
      if (bookedConflict) {
        slots.push({ time: timeStr, available: false, reason: 'booked' });
        continue;
      }

      // Check walk-in block overlap
      const blockConflict = blockedRanges.some(
        (r) => slotStart < r.endMinutes && slotEnd > r.startMinutes,
      );
      if (blockConflict) {
        slots.push({ time: timeStr, available: false, reason: 'blocked' });
        continue;
      }

      // Check payment lock overlap
      const lockConflict = lockedRanges.some(
        (r) => slotStart < r.endMinutes && slotEnd > r.startMinutes,
      );
      if (lockConflict) {
        slots.push({ time: timeStr, available: false, reason: 'locked' });
        continue;
      }

      slots.push({ time: timeStr, available: true });
    }

    return slots;
  }

  private emptyResponse(
    input: GetSlotsInput,
    barberName: string,
    totalDurationMinutes: number,
  ): GetSlotsResponse {
    return {
      shopId: input.shopId,
      date: input.date,
      barberId: input.barberId,
      barberName,
      totalDurationMinutes,
      slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
      workingHours: { start: '00:00', end: '00:00' },
      slots: [],
    };
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private fromMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
