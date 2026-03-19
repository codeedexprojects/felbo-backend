import PaymentService from '../payment/payment.service';
import { Logger } from 'winston';
import { BookingRepository } from './booking.repository';
import {
  GetSlotsInput,
  GetSlotsResponse,
  TimeSlot,
  BlockedRange,
  InitiateBookingInput,
  InitiateBookingResponse,
  ConfirmBookingInput,
  ConfirmBookingResponse,
  BookingDetailsDto,
  UserBookingsResponse,
  AdminBookingListParams,
  AdminBookingListResponse,
  AdminBookingDetailDto,
  CancellationReason,
  CancelBookingByBarberResponse,
  CancelBookingByUserResponse,
  CompleteBookingResponse,
  BarberBookingListResponse,
  BarberBookingDetailDto,
  GetBarbersForServicesResponse,
  VendorBookingListParams,
  VendorBookingListResponse,
  VendorBookingDetailDto,
  UserBookingTab,
  UserBookingListResponseV2,
  UserBookingDetailDto,
  BarberDashboardStatsDto,
  BarberTodayBookingsResponse,
} from './booking.types';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../shared/errors';
import {
  getTodayInIst,
  getCurrentIstMinutes,
  parseDateAsIst,
  getIstDayRangeUtc,
  buildAppointmentDate,
  formatAppointmentTime,
} from '../../shared/utils/time';
import {
  enqueueBookingConfirmedUser,
  enqueueNewBookingVendor,
  enqueueReminder15Min,
} from '../../shared/notification/notification.queue';
import { BarberService } from '../barber/barber.service';
import { BarberAvailabilityService } from '../barberAvailability/barberAvailability.service';
import ShopService from '../shop/shop.service';
import UserService from '../user/user.service';
import { ServiceService } from '../service/service.service';
import VendorService from '../vendor/vendor.service';
import { IWorkingHours } from '../shop/shop.model';
import { ConfigService } from '../config/config.service';
import { CONFIG_KEYS } from '../../shared/config/config.keys';
import { FelboCoinService } from '../felbocoin/felbocoin.service';
import { withTransaction } from '../../shared/database/transaction';

// const SLOT_INTERVAL_MINUTES = 15;
const MIN_BUFFER_MINUTES = 30;
const APPOINTMENT_BUFFER_MINUTES = 5;
const SLOT_LOCK_MINUTES = 5;

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export class BookingService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly getBarberService: () => BarberService,
    private readonly getAvailabilityService: () => BarberAvailabilityService,
    private readonly getShopService: () => ShopService,
    private readonly configService: ConfigService,
    private readonly getUserService: () => UserService,
    private readonly getServiceService: () => ServiceService,
    private readonly getPaymentService: () => PaymentService,
    private readonly getVendorService: () => VendorService,
    private readonly logger: Logger,
    private readonly getFelboCoinService: () => FelboCoinService,
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

  private get userService(): UserService {
    return this.getUserService();
  }

  private get serviceService(): ServiceService {
    return this.getServiceService();
  }

  private get paymentService(): PaymentService {
    return this.getPaymentService();
  }

  private get vendorService(): VendorService {
    return this.getVendorService();
  }

  private get felboCoinService(): FelboCoinService {
    return this.getFelboCoinService();
  }

  async getBarbersForServices(
    shopId: string,
    serviceIds: string[],
    userId: string,
  ): Promise<GetBarbersForServicesResponse> {
    const [barbers, bookingAmount, user] = await Promise.all([
      this.barberService.getBarbersForServices(shopId, serviceIds),
      this.configService.getValueAsNumber(CONFIG_KEYS.BOOKING_AMOUNT),
      this.userService.getUserById(userId),
    ]);

    return { barbers, bookingAmount, userCoinBalance: user.felboCoinBalance };
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

    const shop = await this.shopService.getShopById(input.shopId);
    if (shop.status !== 'ACTIVE') {
      throw new NotFoundError('Shop not found or not active.');
    }

    const barber = await this.barberService.getBarberById(input.barberId);
    if (barber.shopId !== input.shopId) {
      throw new ValidationError('Barber does not belong to this shop.');
    }
    if (!barber.isAvailable) {
      return this.emptyResponse(input, barber.name, 0, slotIntervalMinutes);
    }

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

    // Step 4: Walk-in blocks — via barber service to respect module boundaries
    const slotBlocks = await this.barberService.getActiveSlotBlocksByBarberAndDate(
      input.barberId,
      requestedDate,
    );

    // Step 5: Payment locks
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

    const workStart = this.toMinutes(workingHours.start);
    const workEnd = this.toMinutes(workingHours.end);

    const nowMinutesUtc = getCurrentIstMinutes();
    const earliestBookable = nowMinutesUtc + minBufferMinutes;

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

  async getBookingById(bookingId: string): Promise<BookingDetailsDto | null> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) return null;
    return {
      id: booking._id.toString(),
      userId: booking.userId.toString(),
      shopId: booking.shopId.toString(),
      barberId: booking.barberId.toString(),
      status: booking.status,
    };
  }

  async getUserBookings(
    userId: string,
    page: number,
    limit: number,
  ): Promise<UserBookingsResponse> {
    const { bookings, total } = await this.bookingRepository.findByUserId(userId, page, limit);
    return {
      bookings: bookings.map((b) => ({
        id: b._id.toString(),
        bookingNumber: b.bookingNumber,
        shopName: b.shopName,
        barberName: b.barberName,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        totalServiceAmount: b.totalServiceAmount,
        advancePaid: b.advancePaid,
        remainingAmount: b.remainingAmount,
        paymentMethod: b.paymentMethod,
        status: b.status,
        cancellation: b.cancellation
          ? {
              cancelledAt: b.cancellation.cancelledAt,
              cancelledBy: b.cancellation.cancelledBy,
              reason: b.cancellation.reason,
              refundCoins: b.cancellation.refundCoins ?? 0,
              refundStatus: b.cancellation.refundStatus,
            }
          : undefined,
        createdAt: b.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdvancePaidForBooking(bookingId: string): Promise<number> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');
    return booking.advancePaid;
  }

  async getBookingPaymentDetails(bookingId: string): Promise<{
    advancePaid: number;
    paymentId?: string;
    paymentMethod: 'RAZORPAY' | 'FELBO_COINS';
    bookingNumber: string;
  }> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');
    return {
      advancePaid: booking.advancePaid,
      paymentId: booking.paymentId,
      paymentMethod: booking.paymentMethod,
      bookingNumber: booking.bookingNumber,
    };
  }

  async refundIssuePayment(razorpayPaymentId: string, amountPaise: number): Promise<string> {
    return this.paymentService.refundIssuePayment(razorpayPaymentId, amountPaise);
  }

  async processIssueCoinsRefund(bookingId: string, userId: string): Promise<void> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');

    // Refund exactly the coins that were originally paid (1 coin = ₹1 = 1 advance rupee),
    // so config changes after booking time don't affect the refund amount.
    const coinsToRefund = booking.advancePaid;

    await this.felboCoinService.creditCoins({
      userId,
      coins: coinsToRefund,
      type: 'COIN_REFUND',
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      description: `Coins refunded for issue resolution on booking ${booking.bookingNumber}`,
    });
  }

  async getGlobalDashboardStats(): Promise<{
    totalBookings: number;
    todaysBookings: number;
    todaysRevenue: number;
  }> {
    return this.bookingRepository.getGlobalDashboardStats();
  }

  async getStatsByShopIds(shopIds: string[]): Promise<{
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

  async initiateBooking(
    input: InitiateBookingInput,
    userId: string,
  ): Promise<InitiateBookingResponse> {
    // 1. Validate date is today
    const requestedDate = parseDateAsIst(input.date);
    const todayIst = getTodayInIst();
    if (requestedDate.getTime() !== todayIst.getTime()) {
      throw new ValidationError('Bookings are only available for today.');
    }

    // 2. Get user info
    const user = await this.userService.getUserById(userId);

    // 3. Validate shop
    const shop = await this.shopService.getShopById(input.shopId);
    if (shop.status !== 'ACTIVE') {
      throw new NotFoundError('Shop not found or not active.');
    }

    // 4. Validate barber
    const barber = await this.barberService.getBarberById(input.barberId);
    if (barber.shopId !== input.shopId) {
      throw new ValidationError('Barber does not belong to this shop.');
    }
    if (!barber.isAvailable) {
      throw new ValidationError('This barber is currently unavailable.');
    }

    // 5. Validate services and compute total duration
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

    // 6. Get service snapshot data (names, prices, category names)
    const serviceSnapshots = await this.serviceService.getServicesForBookingSnapshot(
      input.serviceIds,
      input.shopId,
    );
    if (serviceSnapshots.length !== input.serviceIds.length) {
      throw new ValidationError('One or more services are invalid or inactive.');
    }
    const serviceSnapshotMap = new Map(serviceSnapshots.map((s) => [s.id, s]));

    // 7. Compute endTime
    const startMinutes = this.toMinutes(input.startTime);
    const endMinutes = startMinutes + totalDurationMinutes;
    const endTime = this.fromMinutes(endMinutes);

    // 8. Validate against shop working hours
    if (
      !this.isWithinShopWorkingHours(shop.workingHours, requestedDate, input.startTime, endTime)
    ) {
      throw new ValidationError('The selected time is outside shop working hours.');
    }

    // 9. Re-validate slot availability
    const availability = await this.availabilityService.getTodayAvailability(input.barberId);
    if (!availability || !availability.isWorking || !availability.workingHours) {
      throw new ValidationError('Barber is not working today.');
    }

    const nowMinutes = getCurrentIstMinutes();
    if (startMinutes < nowMinutes + MIN_BUFFER_MINUTES) {
      throw new ValidationError('Selected time is too soon. Please choose a later slot.');
    }

    const slotRange: BlockedRange = { startMinutes, endMinutes };

    for (const br of availability.breaks ?? []) {
      if (
        this.rangesOverlap(slotRange, {
          startMinutes: this.toMinutes(br.start),
          endMinutes: this.toMinutes(br.end),
        })
      ) {
        throw new ValidationError('Selected time overlaps with a barber break.');
      }
    }

    const confirmedBookings = await this.bookingRepository.findConfirmedBookingsByBarberAndDate(
      input.barberId,
      requestedDate,
    );
    for (const b of confirmedBookings) {
      if (
        this.rangesOverlap(slotRange, {
          startMinutes: this.toMinutes(b.startTime),
          endMinutes: this.toMinutes(b.endTime) + APPOINTMENT_BUFFER_MINUTES,
        })
      ) {
        throw new ValidationError('Selected time slot is no longer available.');
      }
    }

    const slotBlocks = await this.barberService.getActiveSlotBlocksByBarberAndDate(
      input.barberId,
      requestedDate,
    );
    for (const block of slotBlocks) {
      if (
        this.rangesOverlap(slotRange, {
          startMinutes: this.toMinutes(block.startTime),
          endMinutes: this.toMinutes(block.endTime),
        })
      ) {
        throw new ValidationError('Selected time slot is blocked.');
      }
    }

    const slotLocks = await this.bookingRepository.findActiveSlotLocksByBarberAndDate(
      input.barberId,
      requestedDate,
    );
    for (const lock of slotLocks) {
      if (
        this.rangesOverlap(slotRange, {
          startMinutes: this.toMinutes(lock.startTime),
          endMinutes: this.toMinutes(lock.endTime),
        })
      ) {
        throw new ValidationError('Selected time slot is currently being held by another user.');
      }
    }

    // 10. Fetch advance amount and coin threshold from config
    const [advanceAmountRupees, coinRedeemThreshold] = await Promise.all([
      this.configService.getValueAsNumber(CONFIG_KEYS.BOOKING_AMOUNT),
      this.configService.getValueAsNumber(CONFIG_KEYS.COIN_REDEEM_THRESHOLD),
    ]);

    // 11. Build service data for DB and response
    const dbServices = input.serviceIds.map((serviceId) => {
      const snap = serviceSnapshotMap.get(serviceId)!;
      const duration = barberServiceMap.get(serviceId)!;
      return {
        serviceId,
        serviceName: snap.name,
        categoryName: snap.categoryName,
        durationMinutes: duration,
        price: snap.basePrice,
      };
    });

    const totalServiceAmount = dbServices.reduce((sum, s) => sum + s.price, 0);
    const remainingAmount = totalServiceAmount - advanceAmountRupees;

    const lockExpiresAt = new Date(Date.now() + SLOT_LOCK_MINUTES * 60 * 1000);
    await this.bookingRepository.createSlotLock({
      shopId: input.shopId,
      barberId: input.barberId,
      date: requestedDate,
      startTime: input.startTime,
      endTime,
      lockedBy: userId,
      expiresAt: lockExpiresAt,
    });

    const timePart = (Date.now() % 46656).toString(36).padStart(3, '0').toUpperCase();
    const randomPart = Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, '0');
    const bookingNumber = `${timePart}${randomPart}`;
    const verificationCode = String(Math.floor(1000 + Math.random() * 9000));

    const responseServices = input.serviceIds.map((serviceId) => {
      const snap = serviceSnapshotMap.get(serviceId)!;
      const duration = barberServiceMap.get(serviceId)!;
      return {
        serviceId,
        serviceName: snap.name,
        price: snap.basePrice,
        durationMinutes: duration,
      };
    });

    if (input.paymentMethod === 'FELBO_COINS') {
      if (user.felboCoinBalance < coinRedeemThreshold) {
        throw new ValidationError(
          `Insufficient FelboCoin balance. You need at least ${coinRedeemThreshold} coins to use FelboCoin payment.`,
        );
      }

      let booking: Awaited<ReturnType<BookingRepository['createBooking']>>;

      await withTransaction(async (session) => {
        booking = await this.bookingRepository.createBooking(
          {
            bookingNumber,
            userId,
            userName: user.name ?? '',
            userPhone: user.phone,
            shopId: input.shopId,
            shopName: shop.name,
            barberId: input.barberId,
            barberName: barber.name,
            barberSelectionType: 'SPECIFIC',
            date: requestedDate,
            startTime: input.startTime,
            endTime,
            totalDurationMinutes,
            services: dbServices,
            totalServiceAmount,
            advancePaid: advanceAmountRupees,
            remainingAmount,
            paymentMethod: 'FELBO_COINS',
            verificationCode,
            status: 'CONFIRMED',
          },
          session,
        );

        await this.felboCoinService.debitCoins(
          {
            userId,
            coins: coinRedeemThreshold,
            type: 'COIN_REDEEMED',
            bookingId: booking!._id.toString(),
            bookingNumber,
            description: `Advance payment waived for booking ${bookingNumber}`,
          },
          session,
        );
      });

      this.logger.info({
        action: 'BOOKING_CONFIRMED_VIA_FELBOCOIN',
        module: 'booking',
        bookingId: booking!._id.toString(),
        bookingNumber,
        userId,
        coinsUsed: coinRedeemThreshold,
      });

      const coinAppointmentTime = formatAppointmentTime(booking!.startTime);
      const coinAppointmentAt = buildAppointmentDate(booking!.date, booking!.startTime);
      const coinBookingId = booking!._id.toString();
      const coinBarberId = booking!.barberId.toString();
      const coinServiceName = booking!.services.map((s) => s.serviceName).join(', ');

      void enqueueBookingConfirmedUser({
        userId,
        shopName: shop.name,
        appointmentTime: coinAppointmentTime,
        bookingId: coinBookingId,
      });
      void enqueueNewBookingVendor({
        barberId: coinBarberId,
        customerName: user.name ?? '',
        serviceName: coinServiceName,
        appointmentTime: coinAppointmentTime,
      });
      void enqueueReminder15Min({
        userId,
        barberId: coinBarberId,
        shopName: shop.name,
        appointmentTime: coinAppointmentTime,
        appointmentAt: coinAppointmentAt,
        bookingId: coinBookingId,
      });

      return {
        booking: {
          id: booking!._id.toString(),
          bookingNumber,
          status: booking!.status,
          shop: { id: input.shopId, name: shop.name },
          barber: { id: input.barberId, name: barber.name },
          services: responseServices,
          date: input.date,
          startTime: input.startTime,
          endTime,
          totalServiceAmount,
          advancePaid: advanceAmountRupees,
          remainingAmount,
          paymentMethod: 'FELBO_COINS',
          verificationCode,
          expiresAt: lockExpiresAt.toISOString(),
        },
      };
    }

    // 14b. Razorpay payment: create order and pending booking
    const { orderId } = await this.paymentService.createBookingAdvanceOrder({
      userId,
      shopId: input.shopId,
      amountRupees: advanceAmountRupees,
    });

    const booking = await this.bookingRepository.createBooking({
      bookingNumber,
      userId,
      userName: user.name ?? '',
      userPhone: user.phone,
      shopId: input.shopId,
      shopName: shop.name,
      barberId: input.barberId,
      barberName: barber.name,
      barberSelectionType: 'SPECIFIC',
      date: requestedDate,
      startTime: input.startTime,
      endTime,
      totalDurationMinutes,
      services: dbServices,
      totalServiceAmount,
      advancePaid: advanceAmountRupees,
      remainingAmount,
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: orderId,
      verificationCode,
      status: 'PENDING_PAYMENT',
    });

    this.logger.info({
      action: 'BOOKING_INITIATED',
      module: 'booking',
      bookingId: booking._id.toString(),
      bookingNumber,
      userId,
      shopId: input.shopId,
      barberId: input.barberId,
    });

    return {
      booking: {
        id: booking._id.toString(),
        bookingNumber,
        status: booking.status,
        shop: { id: input.shopId, name: shop.name },
        barber: { id: input.barberId, name: barber.name },
        services: responseServices,
        date: input.date,
        startTime: input.startTime,
        endTime,
        totalServiceAmount,
        advancePaid: advanceAmountRupees,
        remainingAmount,
        paymentMethod: 'RAZORPAY',
        verificationCode,
        expiresAt: lockExpiresAt.toISOString(),
      },
      payment: { orderId, amount: advanceAmountRupees * 100, currency: 'INR' },
    };
  }

  async confirmBooking(
    bookingId: string,
    input: ConfirmBookingInput,
    userId: string,
  ): Promise<ConfirmBookingResponse> {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.userId.toString() !== userId) {
      throw new ValidationError('You are not authorised to confirm this booking.');
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new ValidationError('This booking is not awaiting payment.');
    }

    if (!booking.razorpayOrderId || booking.razorpayOrderId !== input.razorpayOrderId) {
      throw new ValidationError('Payment order ID mismatch.');
    }

    await this.paymentService.verifyBookingPayment({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });

    const confirmed = await this.bookingRepository.updateBookingConfirmed(
      bookingId,
      input.razorpayPaymentId,
    );
    if (!confirmed) {
      throw new NotFoundError('Booking not found.');
    }

    this.logger.info({
      action: 'BOOKING_CONFIRMED',
      module: 'booking',
      bookingId,
      paymentId: input.razorpayPaymentId,
      userId,
    });

    const appointmentTime = formatAppointmentTime(confirmed.startTime);
    const appointmentAt = buildAppointmentDate(confirmed.date, confirmed.startTime);
    const confirmedBarberId = confirmed.barberId.toString();
    const confirmedServiceName = confirmed.services.map((s) => s.serviceName).join(', ');

    void enqueueBookingConfirmedUser({
      userId,
      shopName: confirmed.shopName,
      appointmentTime,
      bookingId,
    });

    void enqueueNewBookingVendor({
      barberId: confirmedBarberId,
      customerName: confirmed.userName,
      serviceName: confirmedServiceName,
      appointmentTime,
    });

    void enqueueReminder15Min({
      userId,
      barberId: confirmedBarberId,
      shopName: confirmed.shopName,
      appointmentTime,
      appointmentAt,
      bookingId,
    });

    return {
      booking: {
        id: confirmed._id.toString(),
        bookingNumber: confirmed.bookingNumber,
        status: confirmed.status,
        paymentId: input.razorpayPaymentId,
      },
    };
  }

  async cancelBookingByBarber(
    bookingId: string,
    reason: CancellationReason,
    barberId: string,
  ): Promise<CancelBookingByBarberResponse> {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');

    if (booking.barberId.toString() !== barberId) {
      throw new ForbiddenError('You are not assigned to this booking.');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new ConflictError(
        booking.status === 'CANCELLED_BY_USER' || booking.status === 'CANCELLED_BY_VENDOR'
          ? 'This booking has already been cancelled.'
          : 'Only confirmed bookings can be cancelled.',
      );
    }

    const weeklyLimit = await this.configService.getValueAsNumber(
      CONFIG_KEYS.SHOP_CANCEL_WEEKLY_LIMIT,
    );

    let cancelled: Awaited<ReturnType<BookingRepository['updateBookingCancelled']>> = null;

    if (booking.paymentMethod === 'FELBO_COINS') {
      // FelboCoin-paid booking: return coins to user (COIN_REVERSAL) atomically
      const coinRedeemThreshold = await this.configService.getValueAsNumber(
        CONFIG_KEYS.COIN_REDEEM_THRESHOLD,
      );

      await withTransaction(async (session) => {
        cancelled = await this.bookingRepository.updateBookingCancelled(
          bookingId,
          {
            cancelledBy: 'VENDOR',
            reason,
            refundAmount: 0,
            refundCoins: coinRedeemThreshold,
            refundType: 'FELBO_COINS',
            refundStatus: 'COMPLETED',
          },
          session,
        );

        if (!cancelled || !cancelled.cancellation) {
          throw new ConflictError(
            'Booking could not be cancelled — it may have already been updated.',
          );
        }

        await this.felboCoinService.creditCoins(
          {
            userId: booking.userId.toString(),
            coins: coinRedeemThreshold,
            type: 'COIN_REVERSAL',
            bookingId: booking._id.toString(),
            bookingNumber: booking.bookingNumber,
            description: `Coins returned for barber-cancelled booking ${booking.bookingNumber}`,
          },
          session,
        );
      });
    } else {
      // Razorpay-paid booking: issue Razorpay refund
      if (!booking.paymentId) {
        throw new ValidationError('No payment record found for this booking.');
      }

      await this.paymentService.refundBookingAdvance(booking.paymentId, booking.advancePaid * 100);

      cancelled = await this.bookingRepository.updateBookingCancelled(bookingId, {
        cancelledBy: 'VENDOR',
        reason,
        refundAmount: booking.advancePaid,
        refundCoins: 0,
        refundType: 'ORIGINAL',
        refundStatus: 'PENDING',
      });

      if (!cancelled || !cancelled.cancellation) {
        throw new ConflictError(
          'Booking could not be cancelled — it may have already been updated.',
        );
      }
    }

    const { cancellationsThisWeek, vendorId } =
      await this.shopService.incrementShopCancellationCount(booking.shopId.toString());

    let flagged = false;
    if (cancellationsThisWeek >= weeklyLimit) {
      await this.vendorService.flagVendor(vendorId);
      flagged = true;
    }

    this.logger.info({
      action: 'BOOKING_CANCELLED_BY_BARBER',
      module: 'booking',
      bookingId,
      barberId,
      shopId: booking.shopId.toString(),
      reason,
      flagged,
    });

    return {
      booking: {
        id: cancelled!._id.toString(),
        bookingNumber: cancelled!.bookingNumber,
        status: cancelled!.status,
        cancellation: {
          cancelledAt: cancelled!.cancellation!.cancelledAt.toISOString(),
          cancelledBy: cancelled!.cancellation!.cancelledBy,
          reason: cancelled!.cancellation!.reason,
          refundAmount: cancelled!.cancellation!.refundAmount,
          refundCoins: cancelled!.cancellation!.refundCoins ?? 0,
          refundType: cancelled!.cancellation!.refundType,
          refundStatus: cancelled!.cancellation!.refundStatus,
        },
      },
    };
  }

  async cancelBookingByUser(
    bookingId: string,
    reason: string,
    userId: string,
  ): Promise<CancelBookingByUserResponse> {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');

    if (booking.userId.toString() !== userId) {
      throw new ForbiddenError('You are not authorised to cancel this booking.');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new ConflictError(
        booking.status === 'CANCELLED_BY_USER' || booking.status === 'CANCELLED_BY_VENDOR'
          ? 'This booking has already been cancelled.'
          : 'Only confirmed bookings can be cancelled.',
      );
    }

    const [freeCancelWindowMinutes, refundCoinsConfig] = await Promise.all([
      this.configService.getValueAsNumber(CONFIG_KEYS.FREE_CANCELLATION_WINDOW_MINUTES),
      this.configService.getValueAsNumber(CONFIG_KEYS.COIN_CANCELLATION_REFUND_COINS),
    ]);

    const nowMinutes = getCurrentIstMinutes();
    const bookingStartMinutes = this.toMinutes(booking.startTime);
    const minutesUntilBooking = bookingStartMinutes - nowMinutes;

    if (minutesUntilBooking <= 0) {
      throw new ValidationError('Cannot cancel a booking that has already started or passed.');
    }

    const createdAtTime = booking.createdAt ? booking.createdAt.getTime() : Date.now();
    const elapsedMinutesSinceBooking = (Date.now() - createdAtTime) / (1000 * 60);

    const isEarlyCancel = elapsedMinutesSinceBooking <= freeCancelWindowMinutes;
    const refundCoins = isEarlyCancel ? refundCoinsConfig : 0;

    // Cancel and credit coins atomically so they never get out of sync
    let cancelled: typeof booking | null = null;

    await withTransaction(async (session) => {
      cancelled = await this.bookingRepository.updateBookingCancelled(
        bookingId,
        {
          cancelledBy: 'USER',
          reason,
          refundAmount: 0,
          refundCoins: refundCoins,
          refundType: 'FELBO_COINS',
          refundStatus: 'COMPLETED',
        },
        session,
      );

      if (!cancelled || !cancelled.cancellation) {
        throw new ConflictError(
          'Booking could not be cancelled — it may have already been updated.',
        );
      }

      if (isEarlyCancel && refundCoins > 0) {
        await this.felboCoinService.creditCoins(
          {
            userId,
            coins: refundCoins,
            type: 'COIN_REFUND',
            bookingId: booking._id.toString(),
            bookingNumber: booking.bookingNumber,
            description: `Refund for early cancellation of booking ${booking.bookingNumber}`,
          },
          session,
        );
      }

      await this.userService.incrementCancellationCount(userId, session);
    });

    this.logger.info({
      action: 'BOOKING_CANCELLED_BY_USER',
      module: 'booking',
      bookingId,
      userId,
      isEarlyCancel,
      refundCoins,
    });

    return {
      booking: {
        id: cancelled!._id.toString(),
        bookingNumber: cancelled!.bookingNumber,
        status: cancelled!.status,
        cancellation: {
          cancelledAt: cancelled!.cancellation!.cancelledAt.toISOString(),
          cancelledBy: cancelled!.cancellation!.cancelledBy,
          reason: cancelled!.cancellation!.reason,
          refundCoins,
        },
      },
    };
  }

  async completeBooking(
    bookingId: string,
    barberId: string,
    verificationCode: string,
  ): Promise<CompleteBookingResponse> {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');

    if (booking.barberId.toString() !== barberId) {
      throw new ForbiddenError('You are not assigned to this booking.');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new ConflictError(
        booking.status === 'COMPLETED'
          ? 'Booking has already been completed.'
          : 'Only confirmed bookings can be marked as completed.',
      );
    }

    if (booking.verificationCode !== verificationCode) {
      throw new ValidationError('Invalid verification code.');
    }

    const coinsEarned = await this.configService.getValueAsNumber(
      CONFIG_KEYS.COIN_EARN_PER_BOOKING,
    );

    let completed: Awaited<ReturnType<BookingRepository['updateBookingCompleted']>>;

    await withTransaction(async (session) => {
      completed = await this.bookingRepository.updateBookingCompleted(bookingId, session);
      if (!completed) throw new ConflictError('Booking has already been completed.');

      await this.felboCoinService.creditCoins(
        {
          userId: booking.userId.toString(),
          coins: coinsEarned,
          type: 'COIN_EARNED',
          bookingId: booking._id.toString(),
          bookingNumber: booking.bookingNumber,
          description: `Coins earned for completing booking ${booking.bookingNumber}`,
        },
        session,
      );
    });

    this.logger.info({
      action: 'BOOKING_COMPLETED',
      module: 'booking',
      bookingId,
      barberId,
      userId: booking.userId.toString(),
      coinsEarned,
    });

    return {
      booking: {
        id: completed!._id.toString(),
        bookingNumber: completed!.bookingNumber,
        status: completed!.status,
        completedAt: completed!.completedAt!,
        coinsEarned,
      },
    };
  }

  async getBarberBookings(
    barberId: string,
    page: number,
    limit: number,
    status?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<BarberBookingListResponse> {
    const { bookings, total } = await this.bookingRepository.findByBarberId(
      barberId,
      page,
      limit,
      status,
      startDate,
      endDate,
    );
    return {
      bookings: bookings.map((b) => ({
        id: b._id.toString(),
        bookingNumber: b.bookingNumber,
        userName: b.userName,
        userImage: b.userImage,
        date: b.date,
        startTime: b.startTime,
        services: b.services.map((s) => s.serviceName),
        status: b.status,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBarberBookingDetail(
    bookingId: string,
    barberId: string,
  ): Promise<BarberBookingDetailDto> {
    const booking = await this.bookingRepository.barberGetBookingDetail(bookingId, barberId);
    if (!booking) throw new NotFoundError('Booking not found.');

    return {
      id: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      customer: {
        name: booking.userName,
        image: booking.userImage,
        gender: booking.userGender,
      },
      services: booking.services.map((s) => ({
        name: s.serviceName,
        durationMinutes: s.durationMinutes,
        price: s.price,
      })),
      payment: {
        total: booking.totalServiceAmount,
        advancePaid: booking.advancePaid,
        remainingToCollect: booking.remainingAmount,
      },
    };
  }

  async getBarberDashboardStats(barberId: string): Promise<BarberDashboardStatsDto> {
    const { start, end } = getIstDayRangeUtc();
    return this.bookingRepository.getBarberDashboardStats(barberId, start, end);
  }

  async getBarberTodayConfirmed(barberId: string): Promise<BarberTodayBookingsResponse> {
    const { start, end } = getIstDayRangeUtc();
    const bookings = await this.bookingRepository.findTodayConfirmedByBarberId(
      barberId,
      start,
      end,
    );
    return {
      bookings: bookings.map((b) => ({
        id: b._id.toString(),
        bookingNumber: b.bookingNumber,
        userImage: b.userImage,
        userName: b.userName,
        services: b.services.map((s) => s.serviceName),
        startTime: b.startTime,
      })),
    };
  }

  private isWithinShopWorkingHours(
    workingHours: IWorkingHours | undefined,
    date: Date,
    startTime: string,
    endTime: string,
  ): boolean {
    if (!workingHours) return false;

    const dayName = DAY_NAMES[date.getUTCDay()] as keyof IWorkingHours;
    const dayHours = workingHours[dayName];

    if (!dayHours || !dayHours.isOpen) return false;

    const shopOpen = this.toMinutes(dayHours.open);
    const shopClose = this.toMinutes(dayHours.close);
    const slotStart = this.toMinutes(startTime);
    const slotEnd = this.toMinutes(endTime);

    return slotStart >= shopOpen && slotEnd <= shopClose;
  }

  private rangesOverlap(a: BlockedRange, b: BlockedRange): boolean {
    return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
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

      if (bookedRanges.some((r) => slotStart < r.endMinutes && slotEnd > r.startMinutes)) {
        slots.push({ time: timeStr, available: false, reason: 'booked' });
        continue;
      }

      if (slotStart < earliestBookable) {
        slots.push({ time: timeStr, available: false, reason: 'passed' });
        continue;
      }

      if (breakRanges.some((r) => slotStart < r.endMinutes && slotEnd > r.startMinutes)) {
        slots.push({ time: timeStr, available: false, reason: 'break' });
        continue;
      }

      if (blockedRanges.some((r) => slotStart < r.endMinutes && slotEnd > r.startMinutes)) {
        slots.push({ time: timeStr, available: false, reason: 'blocked' });
        continue;
      }

      if (lockedRanges.some((r) => slotStart < r.endMinutes && slotEnd > r.startMinutes)) {
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

  async adminGetBookings(params: AdminBookingListParams): Promise<AdminBookingListResponse> {
    if (params.role === 'ASSOCIATION_ADMIN') {
      const vendorIds = await this.vendorService.getAssociationVendorIds();
      params.associatedShopIds = await this.shopService.getShopIdsByVendorIds(
        vendorIds.map((id) => id.toString()),
      );
    }

    const { bookings, total } = await this.bookingRepository.adminGetBookings(params);

    return {
      bookings: bookings.map((b) => ({
        id: b._id.toString(),
        bookingNumber: b.bookingNumber,
        ...(params.role !== 'ASSOCIATION_ADMIN' && { userPhone: b.userPhone }),
        shopName: b.shopName,
        barberName: b.barberName,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        totalServiceAmount: b.totalServiceAmount,
        advancePaid: b.advancePaid,
        remainingAmount: b.remainingAmount,
        status: b.status,
        createdAt: b.createdAt,
      })),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async adminGetBookingDetail(bookingId: string, role: string): Promise<AdminBookingDetailDto> {
    let associatedShopIds: string[] | undefined;

    if (role === 'ASSOCIATION_ADMIN') {
      const vendorIds = await this.vendorService.getAssociationVendorIds();
      associatedShopIds = await this.shopService.getShopIdsByVendorIds(
        vendorIds.map((id) => id.toString()),
      );
    }

    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (
      associatedShopIds &&
      associatedShopIds.length > 0 &&
      !associatedShopIds.includes(booking.shopId.toString())
    ) {
      throw new ForbiddenError('You do not have permission to view this booking.');
    }

    return {
      id: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      ...(role !== 'ASSOCIATION_ADMIN' && {
        userId: booking.userId.toString(),
        userName: booking.userName,
        userPhone: booking.userPhone,
      }),
      shopId: booking.shopId.toString(),
      shopName: booking.shopName,
      barberId: booking.barberId.toString(),
      barberName: booking.barberName,
      barberSelectionType: booking.barberSelectionType,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalDurationMinutes: booking.totalDurationMinutes,
      services: booking.services.map((s) => ({
        serviceId: s.serviceId.toString(),
        serviceName: s.serviceName,
        price: s.price,
        durationMinutes: s.durationMinutes,
      })),
      totalServiceAmount: booking.totalServiceAmount,
      advancePaid: booking.advancePaid,
      remainingAmount: booking.remainingAmount,
      paymentMethod: booking.paymentMethod,
      paymentId: booking.paymentId,
      razorpayOrderId: booking.razorpayOrderId,
      status: booking.status,
      cancellation: booking.cancellation
        ? {
            cancelledAt: booking.cancellation.cancelledAt,
            cancelledBy: booking.cancellation.cancelledBy,
            reason: booking.cancellation.reason,
            refundAmount: booking.cancellation.refundAmount,
            refundCoins: booking.cancellation.refundCoins ?? 0,
            refundType: booking.cancellation.refundType,
            refundStatus: booking.cancellation.refundStatus,
          }
        : undefined,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  async vendorGetBookingDetail(
    bookingId: string,
    shopIds: string[],
  ): Promise<VendorBookingDetailDto> {
    const booking = await this.bookingRepository.vendorGetBookingDetail(bookingId, shopIds);
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    return {
      id: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      barberName: booking.barberName,
      user: {
        name: booking.userName,
        profileUrl: booking.userProfileUrl,
      },
      services: booking.services.map((s) => ({
        name: s.serviceName,
        durationMinutes: s.durationMinutes,
        price: s.price,
      })),
      payment: {
        total: booking.totalServiceAmount,
        advancePaid: booking.advancePaid,
        remainingAmount: booking.remainingAmount,
      },
      status: booking.status,
    };
  }

  async vendorGetBookings(params: VendorBookingListParams): Promise<VendorBookingListResponse> {
    const { bookings, total } = await this.bookingRepository.vendorGetBookings(params);

    return {
      bookings: bookings.map((b) => ({
        id: b._id.toString(),
        bookingNumber: b.bookingNumber,
        userName: b.userName,
        userImage: b.userImage,
        barberName: b.barberName,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        services: b.services.map((s) => s.serviceName),
        status: b.status,
      })),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  private fromMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  async getUserBookingsList(
    userId: string,
    tab: UserBookingTab,
    page: number,
    limit: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UserBookingListResponseV2> {
    const statusMap: Record<UserBookingTab, string[]> = {
      upcoming: ['CONFIRMED'],
      completed: ['COMPLETED'],
      cancelled: ['CANCELLED_BY_USER', 'CANCELLED_BY_VENDOR', 'NO_SHOW'],
    };

    const { bookings, total } = await this.bookingRepository.findUserBookingsList(
      userId,
      statusMap[tab],
      page,
      limit,
      startDate,
      endDate,
    );

    return {
      bookings: bookings.map((b) => ({
        id: b._id.toString(),
        bookingNumber: b.bookingNumber,
        shopName: b.shopName,
        shopImage: b.shopImage,
        barberName: b.barberName,
        services: b.services.map((s) => s.serviceName),
        status: b.status,
        date: b.date,
        startTime: b.startTime,
        otp: b.verificationCode,
        isReviewed: b.isReviewed,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserBookingDetail(userId: string, bookingId: string): Promise<UserBookingDetailDto> {
    const booking = await this.bookingRepository.findUserBookingDetail(bookingId, userId);
    if (!booking) throw new NotFoundError('Booking not found.');

    const addr = booking.shopAddress;
    const addressStr = addr
      ? [addr.line1, addr.line2, addr.area, addr.city, addr.district, addr.state, addr.pincode]
          .filter(Boolean)
          .join(', ')
      : '';

    return {
      id: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      otp: booking.verificationCode,
      barberName: booking.barberName,
      shop: {
        id: booking.shopId.toString(),
        name: booking.shopName,
        image: booking.shopImage,
        address: addressStr,
        coordinates: booking.shopCoordinates,
      },
      services: booking.services.map((s) => ({
        name: s.serviceName,
        amount: s.price,
      })),
      payment: {
        advancePaid: booking.advancePaid,
        total: booking.totalServiceAmount,
        remainingAmount: booking.remainingAmount,
      },
      cancellation: booking.cancellation
        ? {
            cancelledAt: booking.cancellation.cancelledAt,
            cancelledBy: booking.cancellation.cancelledBy,
            reason: booking.cancellation.reason,
            refundAmount: booking.cancellation.refundAmount,
            refundCoins: booking.cancellation.refundCoins ?? 0,
            refundType: booking.cancellation.refundType,
            refundStatus: booking.cancellation.refundStatus,
          }
        : undefined,
    };
  }
}
