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
}
