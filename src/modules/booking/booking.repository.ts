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

  async getStatsByShopIds(shopIds: mongoose.Types.ObjectId[]): Promise<{
    totalBookings: number;
    todaysBookings: number;
    totalRevenue: number;
  }> {
    const { start, end } = this.utcDayRange(new Date());

    const result = await BookingModel.aggregate([
      { $match: { shopId: { $in: shopIds } } },
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
}
