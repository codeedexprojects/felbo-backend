import mongoose, { ClientSession } from 'mongoose';
import { BookingModel, IBooking, SlotLockModel, ISlotLock } from './booking.model';

export class BookingRepository {
  private utcDayRange(date: Date): { start: Date; end: Date } {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
    );
    return { start, end };
  }

  async getGlobalDashboardStats(): Promise<{
    totalBookings: number;
    todaysBookings: number;
    todaysRevenue: number;
  }> {
    const { start, end } = this.utcDayRange(new Date());

    const [result] = await BookingModel.aggregate([
      {
        $facet: {
          totalBookings: [{ $count: 'count' }],
          todaysBookings: [
            { $match: { createdAt: { $gte: start, $lt: end } } },
            { $count: 'count' },
          ],
          todaysRevenue: [
            { $match: { createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, total: { $sum: '$advancePaid' } } },
          ],
        },
      },
    ]).exec();

    return {
      totalBookings: result.totalBookings[0]?.count ?? 0,
      todaysBookings: result.todaysBookings[0]?.count ?? 0,
      todaysRevenue: result.todaysRevenue[0]?.total ?? 0,
    };
  }

  async getStatsByShopIds(shopIds: string[]): Promise<{
    totalBookings: number;
    todaysBookings: number;
    totalRevenue: number;
  }> {
    const { start, end } = this.utcDayRange(new Date());

    const objectIds = shopIds.map((id) => new mongoose.Types.ObjectId(id));

    const result = await BookingModel.aggregate([
      { $match: { shopId: { $in: objectIds } } },
      {
        $facet: {
          totalBookings: [{ $count: 'count' }],
          todaysBookings: [
            { $match: { createdAt: { $gte: start, $lt: end } } },
            { $count: 'count' },
          ],
          totalRevenue: [{ $group: { _id: null, total: { $sum: '$advancePaid' } } }],
        },
      },
    ]).exec();

    const data = result[0];

    return {
      totalBookings: data.totalBookings[0]?.count ?? 0,
      todaysBookings: data.todaysBookings[0]?.count ?? 0,
      totalRevenue: data.totalRevenue[0]?.total ?? 0,
    };
  }

  findById(id: string): Promise<IBooking | null> {
    return BookingModel.findById(id).lean<IBooking>().exec();
  }

  findConfirmedBookingsByBarberAndDate(barberId: string, date: Date): Promise<IBooking[]> {
    const { start, end } = this.utcDayRange(date);
    return BookingModel.find({
      barberId,
      date: { $gte: start, $lt: end },
      status: 'CONFIRMED',
    })
      .lean<IBooking[]>()
      .exec();
  }

  findActiveSlotLocksByBarberAndDate(barberId: string, date: Date): Promise<ISlotLock[]> {
    const { start, end } = this.utcDayRange(date);
    // MongoDB TTL auto-removes expired docs; no need to filter expiresAt manually
    return SlotLockModel.find({
      barberId,
      date: { $gte: start, $lt: end },
    })
      .lean<ISlotLock[]>()
      .exec();
  }

  async createSlotLock(data: {
    shopId: string;
    barberId: string;
    date: Date;
    startTime: string;
    endTime: string;
    lockedBy: string;
    expiresAt: Date;
  }): Promise<ISlotLock> {
    const [lock] = await SlotLockModel.create([data]);
    return lock;
  }

  async createBooking(
    data: {
      bookingNumber: string;
      userId: string;
      userName: string;
      userPhone: string;
      shopId: string;
      shopName: string;
      barberId: string;
      barberName: string;
      barberSelectionType: 'SPECIFIC' | 'ANY_AVAILABLE';
      date: Date;
      startTime: string;
      endTime: string;
      totalDurationMinutes: number;
      services: Array<{
        serviceId: string;
        serviceName: string;
        categoryName: string;
        durationMinutes: number;
        price: number;
      }>;
      totalServiceAmount: number;
      advancePaid: number;
      remainingAmount: number;
      paymentMethod: 'RAZORPAY' | 'WALLET';
      razorpayOrderId?: string;
      status: 'PENDING_PAYMENT' | 'CONFIRMED';
    },
    session?: ClientSession,
  ): Promise<IBooking> {
    const [booking] = await BookingModel.create([data], { session });
    return booking;
  }

  findBookingById(id: string): Promise<IBooking | null> {
    return BookingModel.findById(id).exec();
  }

  updateBookingConfirmed(id: string, paymentId: string): Promise<IBooking | null> {
    return BookingModel.findByIdAndUpdate(
      id,
      { status: 'CONFIRMED', paymentId },
      { returnDocument: 'after' },
    ).exec();
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ bookings: IBooking[]; total: number }> {
    const skip = (page - 1) * limit;
    const filter = { userId };
    const [bookings, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<IBooking[]>()
        .exec(),
      BookingModel.countDocuments(filter).exec(),
    ]);
    return { bookings, total };
  }

  updateBookingCancelled(
    id: string,
    cancellation: {
      cancelledBy: 'USER' | 'VENDOR';
      reason: string;
      refundAmount: number;
      refundType: 'WALLET' | 'ORIGINAL';
      refundStatus: 'PENDING' | 'COMPLETED';
    },
  ): Promise<IBooking | null> {
    return BookingModel.findByIdAndUpdate(
      id,
      {
        status: 'CANCELLED_BY_VENDOR',
        cancellation: {
          ...cancellation,
          cancelledAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    ).exec();
  }

  async findByBarberId(
    barberId: string,
    page: number,
    limit: number,
    status?: string,
  ): Promise<{ bookings: IBooking[]; total: number }> {
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = { barberId };
    if (status) filter.status = status;
    const [bookings, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean<IBooking[]>()
        .exec(),
      BookingModel.countDocuments(filter).exec(),
    ]);
    return { bookings, total };
  }

  async adminGetBookings(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    associatedShopIds?: string[];
  }): Promise<{ bookings: IBooking[]; total: number }> {
    const skip = (params.page - 1) * params.limit;
    const filter: Record<string, unknown> = {};

    if (params.search) {
      const escapedQuery = params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { bookingNumber: { $regex: escapedQuery, $options: 'i' } },
        { userPhone: { $regex: escapedQuery, $options: 'i' } },
        { shopName: { $regex: escapedQuery, $options: 'i' } },
        { barberName: { $regex: escapedQuery, $options: 'i' } },
      ];
    }

    if (params.status) {
      filter.status = params.status;
    }

    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) dateFilter.$gte = params.startDate;
      if (params.endDate) dateFilter.$lte = params.endDate;
      filter.date = dateFilter;
    }

    if (params.associatedShopIds && params.associatedShopIds.length > 0) {
      filter.shopId = {
        $in: params.associatedShopIds.map((id: string) => new mongoose.Types.ObjectId(id)),
      };
    }

    const [bookings, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(params.limit)
        .lean<IBooking[]>()
        .exec(),
      BookingModel.countDocuments(filter).exec(),
    ]);

    return { bookings, total };
  }
}
