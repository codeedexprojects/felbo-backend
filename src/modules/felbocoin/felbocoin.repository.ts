import { ClientSession } from '../../shared/database/transaction';
import { IFelboCoinTransaction, FelboCoinTransactionModel } from './felbocoin.model';
import { CoinTransactionDirection, CoinTransactionType } from './felbocoin.types';

export class FelboCoinRepository {
  async createTransaction(
    data: {
      userId: string;
      type: CoinTransactionType;
      direction: CoinTransactionDirection;
      coins: number;
      balanceBefore: number;
      balanceAfter: number;
      bookingId?: string;
      bookingNumber?: string;
      description: string;
    },
    session?: ClientSession,
  ): Promise<IFelboCoinTransaction> {
    const [tx] = await FelboCoinTransactionModel.create([data], { session });
    return tx;
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ transactions: IFelboCoinTransaction[]; total: number }> {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      FelboCoinTransactionModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<IFelboCoinTransaction[]>()
        .exec(),
      FelboCoinTransactionModel.countDocuments({ userId }).exec(),
    ]);
    return { transactions, total };
  }
}
