import mongoose, { ClientSession } from 'mongoose';
import { BookingModel, IBooking, SlotLockModel, ISlotLock } from './booking.model';
import { VendorBookingListParams } from './booking.types';

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
      paymentMethod: 'RAZORPAY' | 'FELBO_COINS';
      razorpayOrderId?: string;
      verificationCode: string;
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
      refundType: 'FELBO_COINS' | 'ORIGINAL';
      refundStatus: 'PENDING' | 'COMPLETED';
    },
    session?: ClientSession,
  ): Promise<IBooking | null> {
    const status =
      cancellation.cancelledBy === 'USER' ? 'CANCELLED_BY_USER' : 'CANCELLED_BY_VENDOR';
    // Conditional: only cancels if the booking is still CONFIRMED — prevents double-cancellation
    return BookingModel.findOneAndUpdate(
      { _id: id, status: 'CONFIRMED' },
      {
        status,
        cancellation: {
          ...cancellation,
          cancelledAt: new Date(),
        },
      },
      { returnDocument: 'after', session },
    ).exec();
  }

  updateBookingCompleted(id: string, session?: ClientSession): Promise<IBooking | null> {
    // Conditional: only completes if the booking is still CONFIRMED — prevents double-completion
    return BookingModel.findOneAndUpdate(
      { _id: id, status: 'CONFIRMED' },
      { status: 'COMPLETED', completedAt: new Date() },
      { returnDocument: 'after', session },
    ).exec();
  }

  async findByBarberId(
    barberId: string,
    page: number,
    limit: number,
    status?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    bookings: Array<{
      _id: mongoose.Types.ObjectId;
      bookingNumber: string;
      userName: string;
      userImage: string | null;
      date: Date;
      startTime: string;
      services: Array<{ serviceName: string }>;
      status: string;
    }>;
    total: number;
  }> {
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = {
      barberId: new mongoose.Types.ObjectId(barberId),
      status: { $in: ['CONFIRMED', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_VENDOR'] },
    };
    if (status) match.status = status;
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lt = endDate;
      match.date = dateFilter;
    }

    const [bookings, totalArr] = await Promise.all([
      BookingModel.aggregate([
        { $match: match },
        { $sort: { date: -1, startTime: 1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [{ $project: { profileUrl: 1 } }],
          },
        },
        {
          $project: {
            bookingNumber: 1,
            userName: 1,
            userImage: { $ifNull: [{ $arrayElemAt: ['$user.profileUrl', 0] }, null] },
            date: 1,
            startTime: 1,
            services: 1,
            status: 1,
          },
        },
      ]).exec(),
      BookingModel.aggregate([{ $match: match }, { $count: 'total' }]).exec(),
    ]);

    return { bookings, total: totalArr[0]?.total ?? 0 };
  }

  async barberGetBookingDetail(
    bookingId: string,
    barberId: string,
  ): Promise<{
    _id: mongoose.Types.ObjectId;
    bookingNumber: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: string;
    userName: string;
    userImage: string | null;
    userGender: string | null;
    services: Array<{ serviceName: string; durationMinutes: number; price: number }>;
    totalServiceAmount: number;
    advancePaid: number;
    remainingAmount: number;
  } | null> {
    const [result] = await BookingModel.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(bookingId),
          barberId: new mongoose.Types.ObjectId(barberId),
          status: { $ne: 'PENDING_PAYMENT' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { profileUrl: 1, gender: 1 } }],
        },
      },
      {
        $project: {
          bookingNumber: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          userName: 1,
          userImage: { $ifNull: [{ $arrayElemAt: ['$user.profileUrl', 0] }, null] },
          userGender: { $ifNull: [{ $arrayElemAt: ['$user.gender', 0] }, null] },
          services: 1,
          totalServiceAmount: 1,
          advancePaid: 1,
          remainingAmount: 1,
        },
      },
    ]).exec();

    return result ?? null;
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

  async vendorGetBookingDetail(
    bookingId: string,
    shopIds: string[],
  ): Promise<{
    _id: mongoose.Types.ObjectId;
    bookingNumber: string;
    date: Date;
    startTime: string;
    endTime: string;
    userName: string;
    userProfileUrl: string | null;
    services: Array<{ serviceName: string; durationMinutes: number; price: number }>;
    totalServiceAmount: number;
    advancePaid: number;
    remainingAmount: number;
    status: string;
  } | null> {
    const shopObjectIds = shopIds.map((id) => new mongoose.Types.ObjectId(id));
    const [result] = await BookingModel.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(bookingId),
          shopId: { $in: shopObjectIds },
          status: { $nin: ['PENDING_PAYMENT'] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { profileUrl: 1 } }],
        },
      },
      {
        $project: {
          bookingNumber: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          userName: 1,
          userProfileUrl: { $ifNull: [{ $arrayElemAt: ['$user.profileUrl', 0] }, null] },
          services: 1,
          totalServiceAmount: 1,
          advancePaid: 1,
          remainingAmount: 1,
          status: 1,
        },
      },
    ]).exec();

    return result ?? null;
  }

  async findUserBookingsList(
    userId: string,
    statuses: string[],
    page: number,
    limit: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    bookings: Array<{
      _id: mongoose.Types.ObjectId;
      bookingNumber: string;
      shopName: string;
      shopImage: string | null;
      services: Array<{ serviceName: string }>;
      status: string;
      date: Date;
      startTime: string;
    }>;
    total: number;
  }> {
    const skip = (page - 1) * limit;

    const match: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
      status: { $in: statuses },
    };
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      match.date = dateFilter;
    }

    const [result] = await BookingModel.aggregate([
      { $match: match },
      {
        $facet: {
          bookings: [
            { $sort: { date: -1, startTime: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'shops',
                localField: 'shopId',
                foreignField: '_id',
                as: 'shop',
                pipeline: [{ $project: { photos: 1 } }],
              },
            },
            {
              $project: {
                bookingNumber: 1,
                shopName: 1,
                shopImage: {
                  $ifNull: [{ $arrayElemAt: [{ $arrayElemAt: ['$shop.photos', 0] }, 0] }, null],
                },
                services: 1,
                status: 1,
                date: 1,
                startTime: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]).exec();

    return {
      bookings: result.bookings,
      total: result.total[0]?.count ?? 0,
    };
  }

  async findUserBookingDetail(
    bookingId: string,
    userId: string,
  ): Promise<{
    _id: mongoose.Types.ObjectId;
    bookingNumber: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: string;
    shopId: mongoose.Types.ObjectId;
    shopName: string;
    shopImage: string | null;
    shopAddress: {
      line1: string;
      line2?: string;
      area: string;
      city: string;
      district: string;
      state: string;
      pincode: string;
    } | null;
    services: Array<{ serviceName: string; price: number }>;
    totalServiceAmount: number;
    advancePaid: number;
    remainingAmount: number;
  } | null> {
    const [result] = await BookingModel.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(bookingId),
          userId: new mongoose.Types.ObjectId(userId),
          status: { $nin: ['PENDING_PAYMENT'] },
        },
      },
      {
        $lookup: {
          from: 'shops',
          localField: 'shopId',
          foreignField: '_id',
          as: 'shop',
          pipeline: [{ $project: { photos: 1, address: 1 } }],
        },
      },
      {
        $project: {
          bookingNumber: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          shopId: 1,
          shopName: 1,
          shopImage: {
            $ifNull: [{ $arrayElemAt: [{ $arrayElemAt: ['$shop.photos', 0] }, 0] }, null],
          },
          shopAddress: { $ifNull: [{ $arrayElemAt: ['$shop.address', 0] }, null] },
          services: 1,
          totalServiceAmount: 1,
          advancePaid: 1,
          remainingAmount: 1,
        },
      },
    ]).exec();

    return result ?? null;
  }

  async getBarberDashboardStats(
    barberId: string,
    todayStart: Date,
    todayEnd: Date,
  ): Promise<{ todayBookings: number; completedBookings: number }> {
    const [result] = await BookingModel.aggregate([
      { $match: { barberId: new mongoose.Types.ObjectId(barberId) } },
      {
        $facet: {
          todayBookings: [
            { $match: { date: { $gte: todayStart, $lt: todayEnd }, status: 'CONFIRMED' } },
            { $count: 'count' },
          ],
          completedBookings: [
            {
              $match: {
                status: 'COMPLETED',
                completedAt: { $gte: todayStart, $lt: todayEnd },
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]).exec();

    return {
      todayBookings: result.todayBookings[0]?.count ?? 0,
      completedBookings: result.completedBookings[0]?.count ?? 0,
    };
  }

  async findTodayConfirmedByBarberId(
    barberId: string,
    todayStart: Date,
    todayEnd: Date,
  ): Promise<
    Array<{
      _id: mongoose.Types.ObjectId;
      bookingNumber: string;
      userName: string;
      userImage: string | null;
      services: Array<{ serviceName: string }>;
      startTime: string;
    }>
  > {
    return BookingModel.aggregate([
      {
        $match: {
          barberId: new mongoose.Types.ObjectId(barberId),
          date: { $gte: todayStart, $lt: todayEnd },
          status: 'CONFIRMED',
        },
      },
      { $sort: { startTime: 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { profileUrl: 1 } }],
        },
      },
      {
        $project: {
          bookingNumber: 1,
          userName: 1,
          userImage: { $ifNull: [{ $arrayElemAt: ['$user.profileUrl', 0] }, null] },
          services: 1,
          startTime: 1,
        },
      },
    ]).exec();
  }

  async vendorGetBookings(params: VendorBookingListParams): Promise<{
    bookings: Array<{
      _id: mongoose.Types.ObjectId;
      bookingNumber: string;
      userName: string;
      userImage: string | null;
      date: Date;
      startTime: string;
      endTime: string;
      services: Array<{ serviceName: string }>;
      status: string;
    }>;
    total: number;
  }> {
    const skip = (params.page - 1) * params.limit;
    const shopObjectIds = params.shopIds.map((id) => new mongoose.Types.ObjectId(id));

    const statusFilter =
      params.status === 'CANCELLED'
        ? ['CANCELLED_BY_USER', 'CANCELLED_BY_VENDOR', 'NO_SHOW']
        : params.status
          ? [params.status]
          : ['CONFIRMED', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_VENDOR', 'NO_SHOW'];

    const matchStage: Record<string, unknown> = {
      shopId: { $in: shopObjectIds },
      status: { $in: statusFilter },
    };
    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) dateFilter.$gte = params.startDate;
      if (params.endDate) dateFilter.$lte = params.endDate;
      matchStage.date = dateFilter;
    }

    const [result] = await BookingModel.aggregate([
      { $match: matchStage },
      {
        $facet: {
          bookings: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: params.limit },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
                pipeline: [{ $project: { profileUrl: 1 } }],
              },
            },
            {
              $project: {
                bookingNumber: 1,
                userName: 1,
                userImage: { $ifNull: [{ $arrayElemAt: ['$user.profileUrl', 0] }, null] },
                date: 1,
                startTime: 1,
                endTime: 1,
                services: 1,
                status: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]).exec();

    return {
      bookings: result.bookings,
      total: result.total[0]?.count ?? 0,
    };
  }
}
