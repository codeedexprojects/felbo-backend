import mongoose from 'mongoose';
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

    const [totalBookings, todaysBookings, revenueResult] = await Promise.all([
      BookingModel.countDocuments().exec(),
      BookingModel.countDocuments({ createdAt: { $gte: start, $lt: end } }).exec(),
      BookingModel.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$advancePaid' } } },
      ]).exec(),
    ]);

    return {
      totalBookings,
      todaysBookings,
      todaysRevenue: (revenueResult[0]?.total as number) ?? 0,
    };
  }

  async getStatsByShopIds(shopIds: mongoose.Types.ObjectId[]): Promise<{
    totalBookings: number;
    todaysBookings: number;
    totalRevenue: number;
  }> {
    const { start, end } = this.utcDayRange(new Date());

    const [totalBookings, todaysBookings, revenueResult] = await Promise.all([
      BookingModel.countDocuments({ shopId: { $in: shopIds } }).exec(),
      BookingModel.countDocuments({
        shopId: { $in: shopIds },
        createdAt: { $gte: start, $lt: end },
      }).exec(),
      BookingModel.aggregate([
        { $match: { shopId: { $in: shopIds } } },
        { $group: { _id: null, total: { $sum: '$advancePaid' } } },
      ]).exec(),
    ]);

    return {
      totalBookings,
      todaysBookings,
      totalRevenue: (revenueResult[0]?.total as number) ?? 0,
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
}
