import { ClientSession } from 'mongoose';
import { BookingModel, IBooking, SlotLockModel, ISlotLock } from './booking.model';

export class BookingRepository {
  private utcDayRange(date: Date): { start: Date; end: Date } {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
    );
    return { start, end };
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
}
