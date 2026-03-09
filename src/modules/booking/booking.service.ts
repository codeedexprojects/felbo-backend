import { Types } from 'mongoose';
import { Logger } from 'winston';
import { BookingRepository } from './booking.repository';
import { GetSlotsInput, GetSlotsResponse, TimeSlot, BlockedRange } from './booking.types';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../shared/errors';
import { getTodayInIst, getCurrentIstMinutes, parseDateAsIst } from '../../shared/utils/time';
import { BarberService } from '../barber/barber.service';
import { BarberAvailabilityService } from '../barberAvailability/barberAvailability.service';
import ShopService from '../shop/shop.service';
import { ConfigService } from '../config/config.service';
import { CONFIG_KEYS } from '../../shared/config/config.keys';

export class BookingService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly getBarberService: () => BarberService,
    private readonly getAvailabilityService: () => BarberAvailabilityService,
    private readonly getShopService: () => ShopService,
    private readonly configService: ConfigService,
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
    const [slotIntervalMinutes, minBufferMinutes, appointmentBufferMinutes] = await Promise.all([
      this.configService.getValueAsNumber(CONFIG_KEYS.SLOT_INTERVAL_MINUTES),
      this.configService.getValueAsNumber(CONFIG_KEYS.MIN_BOOKING_BUFFER_MINUTES),
      this.configService.getValueAsNumber(CONFIG_KEYS.APPOINTMENT_BUFFER_MINUTES),
    ]);

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
      return this.emptyResponse(input, barber.name, 0, slotIntervalMinutes);
    }

    // Validate services and get durations — Step 6 of calc: gather service durations
    const barberServiceLinks = await this.barberService.getBarberServicesByBarberId(input.barberId);
    const barberServiceMap = new Map(
      barberServiceLinks.map((l) => [l.serviceId, l.durationMinutes]),
    );

    const uniqueServiceIds = [...new Set(input.serviceIds)];
    let totalDurationMinutes = 0;
    for (const serviceId of uniqueServiceIds) {
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
      return this.emptyResponse(input, barber.name, totalDurationMinutes, slotIntervalMinutes);
    }

    const workingHours = availability.workingHours;
    const breaks = availability.breaks ?? [];

    // Step 3: Confirmed bookings
    const confirmedBookings = await this.bookingRepository.findConfirmedBookingsByBarberAndDate(
      input.barberId,
      requestedDate,
    );

    // Step 4: Walk-in blocks (slotBlocks) — via barber service to respect module boundaries
    const slotBlocks = await this.barberService.getActiveSlotBlocksByBarberAndDate(
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
      endMinutes: this.toMinutes(b.endTime) + appointmentBufferMinutes,
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
    const earliestBookable = nowMinutesUtc + minBufferMinutes;

    // Step 9: Build and return slot list
    const slots = this.generateSlots({
      workStart,
      workEnd,
      totalDurationMinutes,
      earliestBookable,
      slotIntervalMinutes,
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
      slotIntervalMinutes,
      workingHours,
      slots,
    };
  }

  async getAdvancePaidForBooking(bookingId: string): Promise<number> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');
    return booking.advancePaid;
  }

  async getGlobalDashboardStats(): Promise<{
    totalBookings: number;
    todaysBookings: number;
    todaysRevenue: number;
  }> {
    return this.bookingRepository.getGlobalDashboardStats();
  }

  async getStatsByShopIds(shopIds: Types.ObjectId[]): Promise<{
    totalBookings: number;
    todaysBookings: number;
    totalRevenue: number;
  }> {
    return this.bookingRepository.getStatsByShopIds(shopIds);
  }

  async verifyBookingForIssue(bookingId: string, userId: string, shopId: string): Promise<void> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.userId.toString() !== userId)
      throw new ForbiddenError('This booking does not belong to you.');
    if (booking.shopId.toString() !== shopId)
      throw new ValidationError('Booking does not match the provided shop.');
    if (booking.status === 'CANCELLED_BY_USER' || booking.status === 'CANCELLED_BY_VENDOR')
      throw new ConflictError('Cannot raise an issue for a cancelled booking.');
  }

  private generateSlots(params: {
    workStart: number;
    workEnd: number;
    totalDurationMinutes: number;
    earliestBookable: number;
    slotIntervalMinutes: number;
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
      slotIntervalMinutes,
      breakRanges,
      bookedRanges,
      blockedRanges,
      lockedRanges,
    } = params;

    const slots: TimeSlot[] = [];

    for (
      let slotStart = workStart;
      slotStart + totalDurationMinutes <= workEnd;
      slotStart += slotIntervalMinutes
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
    slotIntervalMinutes: number,
  ): GetSlotsResponse {
    return {
      shopId: input.shopId,
      date: input.date,
      barberId: input.barberId,
      barberName,
      totalDurationMinutes,
      slotIntervalMinutes,
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
