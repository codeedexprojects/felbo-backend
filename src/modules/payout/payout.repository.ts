import { Types } from 'mongoose';
import { BookingModel } from '../booking/booking.model';
import { PayoutModel, IPayout } from './payout.model';
import { COMMISSION_STATUSES } from '../finance/finance.types';
import { PayoutListParams } from './payout.types';

export class PayoutRepository {
  async getAssocBookingCount(shopIds: string[]): Promise<number> {
    return BookingModel.countDocuments({
      shopId: { $in: shopIds.map((id) => new Types.ObjectId(id)) },
      status: { $in: [...COMMISSION_STATUSES] },
    }).exec();
  }

  async getAcceptedPayoutTotals(): Promise<{ totalPaid: number; lastPayoutDate: Date | null }> {
    const [result] = await PayoutModel.aggregate([
      { $match: { status: 'ACCEPTED' } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
          lastPayoutDate: { $max: '$createdAt' },
        },
      },
    ]).exec();

    return {
      totalPaid: result?.totalPaid ?? 0,
      lastPayoutDate: result?.lastPayoutDate ?? null,
    };
  }

  async getPendingAmount(): Promise<number> {
    const [result] = await PayoutModel.aggregate([
      { $match: { status: 'PENDING' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).exec();

    return result?.total ?? 0;
  }

  async findPending(): Promise<IPayout | null> {
    return PayoutModel.findOne({ status: 'PENDING' }).exec();
  }

  async findById(id: string): Promise<IPayout | null> {
    return PayoutModel.findById(id).exec();
  }

  async create(data: {
    amount: number;
    bookingCount: number;
    requestedBy: string;
  }): Promise<IPayout> {
    return new PayoutModel({ ...data, status: 'PENDING' }).save();
  }

  async acceptById(id: string, processedBy: string): Promise<IPayout | null> {
    return PayoutModel.findByIdAndUpdate(
      id,
      { status: 'ACCEPTED', processedBy, processedAt: new Date() },
      { returnDocument: 'after' },
    ).exec();
  }

  async rejectById(
    id: string,
    processedBy: string,
    rejectionReason: string,
  ): Promise<IPayout | null> {
    return PayoutModel.findByIdAndUpdate(
      id,
      { status: 'REJECTED', processedBy, processedAt: new Date(), rejectionReason },
      { returnDocument: 'after' },
    ).exec();
  }

  async findAll(params: PayoutListParams): Promise<{ payouts: IPayout[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (params.status) query.status = params.status;

    const skip = (params.page - 1) * params.limit;

    const [payouts, total] = await Promise.all([
      PayoutModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(params.limit).exec(),
      PayoutModel.countDocuments(query).exec(),
    ]);

    return { payouts, total };
  }
}
