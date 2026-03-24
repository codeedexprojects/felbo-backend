import { PipelineStage } from 'mongoose';
import { ClientSession } from '../../shared/database/transaction';
import { IFelboCoinTransaction, FelboCoinTransactionModel } from './felbocoin.model';
import { UserModel } from '../user/user.model';
import {
  AdminCoinStatsDto,
  AdminTransactionDto,
  AdminLogDto,
  CoinTrendBucketDto,
  CoinUserLeaderboardItemDto,
  CoinTransactionDirection,
  CoinTransactionType,
} from './felbocoin.types';

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
      adminId?: string;
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

  async getStats(from?: Date, to?: Date): Promise<AdminCoinStatsDto> {
    const dateFilter: Record<string, unknown> = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) (dateFilter.createdAt as Record<string, unknown>).$gte = from;
      if (to) (dateFilter.createdAt as Record<string, unknown>).$lte = to;
    }

    const [txAgg, circulationAgg] = await Promise.all([
      FelboCoinTransactionModel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalEarned: {
              $sum: { $cond: [{ $eq: ['$type', 'COIN_EARNED'] }, '$coins', 0] },
            },
            totalRedeemed: {
              $sum: { $cond: [{ $eq: ['$type', 'COIN_REDEEMED'] }, '$coins', 0] },
            },
            totalRefunded: {
              $sum: { $cond: [{ $eq: ['$type', 'COIN_REFUND'] }, '$coins', 0] },
            },
            totalReversed: {
              $sum: { $cond: [{ $eq: ['$type', 'COIN_REVERSAL'] }, '$coins', 0] },
            },
            totalAdminCredit: {
              $sum: { $cond: [{ $eq: ['$type', 'ADMIN_CREDIT'] }, '$coins', 0] },
            },
            totalAdminDebit: {
              $sum: { $cond: [{ $eq: ['$type', 'ADMIN_DEBIT'] }, '$coins', 0] },
            },
          },
        },
      ]),
      UserModel.aggregate([
        { $match: { status: { $ne: 'DELETED' }, felboCoinBalance: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalCoinsInCirculation: { $sum: '$felboCoinBalance' },
            totalUsersWithCoins: { $sum: 1 },
          },
        },
      ]),
    ]);

    const tx = txAgg[0] ?? {};
    const circ = circulationAgg[0] ?? {};

    const totalEarned = tx.totalEarned ?? 0;
    const totalRedeemed = tx.totalRedeemed ?? 0;
    const totalRefunded = tx.totalRefunded ?? 0;
    const totalReversed = tx.totalReversed ?? 0;
    const totalAdminCredit = tx.totalAdminCredit ?? 0;
    const totalAdminDebit = tx.totalAdminDebit ?? 0;

    return {
      totalCoinsInCirculation: circ.totalCoinsInCirculation ?? 0,
      totalUsersWithCoins: circ.totalUsersWithCoins ?? 0,
      totalTransactions: tx.totalTransactions ?? 0,
      totalEarned,
      totalRedeemed,
      totalRefunded,
      totalReversed,
      totalAdminCredit,
      totalAdminDebit,
      netCoinsIssued:
        totalEarned +
        totalRefunded +
        totalReversed +
        totalAdminCredit -
        totalRedeemed -
        totalAdminDebit,
    };
  }

  async findAllWithFilters(
    filters: {
      search?: string;
      type?: CoinTransactionType;
      direction?: CoinTransactionDirection;
      from?: Date;
      to?: Date;
    },
    page: number,
    limit: number,
  ): Promise<{ transactions: AdminTransactionDto[]; total: number }> {
    // Transaction-level pre-filter (uses indexes)
    const txMatch: Record<string, unknown> = {};
    if (filters.type) txMatch.type = filters.type;
    if (filters.direction) txMatch.direction = filters.direction;
    if (filters.from || filters.to) {
      txMatch.createdAt = {};
      if (filters.from) (txMatch.createdAt as Record<string, unknown>).$gte = filters.from;
      if (filters.to) (txMatch.createdAt as Record<string, unknown>).$lte = filters.to;
    }

    const userMatch: Record<string, unknown> | null = filters.search
      ? (() => {
          const escaped = filters.search!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return {
            $or: [
              { 'user.name': { $regex: escaped, $options: 'i' } },
              { 'user.phone': { $regex: escaped, $options: 'i' } },
            ],
          };
        })()
      : null;

    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: txMatch },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      ...(userMatch ? [{ $match: userMatch }] : []),
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                userId: 1,
                userName: '$user.name',
                userPhone: '$user.phone',
                type: 1,
                direction: 1,
                coins: 1,
                balanceBefore: 1,
                balanceAfter: 1,
                bookingNumber: 1,
                adminId: 1,
                description: 1,
                createdAt: 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await FelboCoinTransactionModel.aggregate(pipeline);
    const rows = result?.data ?? [];
    const total = result?.totalCount?.[0]?.count ?? 0;

    return {
      transactions: rows.map(
        (
          r: AdminTransactionDto & {
            _id: { toString(): string };
            userId: { toString(): string };
            adminId?: { toString(): string };
          },
        ) => ({
          id: r._id.toString(),
          userId: r.userId.toString(),
          userName: (r as unknown as Record<string, string>).userName ?? 'Unknown',
          userPhone: (r as unknown as Record<string, string>).userPhone ?? '',
          type: r.type,
          direction: r.direction,
          coins: r.coins,
          balanceBefore: r.balanceBefore,
          balanceAfter: r.balanceAfter,
          bookingNumber: (r as unknown as Record<string, string | undefined>).bookingNumber,
          adminId: r.adminId?.toString(),
          description: r.description,
          createdAt: r.createdAt,
        }),
      ),
      total,
    };
  }

  async getTrend(
    from: Date,
    to: Date,
    granularity: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ): Promise<CoinTrendBucketDto[]> {
    const dateGroupId = (() => {
      switch (granularity) {
        case 'weekly':
          return { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } };
        case 'monthly':
          return { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
        case 'yearly':
          return { year: { $year: '$createdAt' } };
        default:
          return {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          };
      }
    })();

    const rows = await FelboCoinTransactionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: dateGroupId,
          coinsEarned: {
            $sum: { $cond: [{ $eq: ['$type', 'COIN_EARNED'] }, '$coins', 0] },
          },
          coinsRedeemed: {
            $sum: { $cond: [{ $eq: ['$type', 'COIN_REDEEMED'] }, '$coins', 0] },
          },
          coinsRefunded: {
            $sum: { $cond: [{ $eq: ['$type', 'COIN_REFUND'] }, '$coins', 0] },
          },
          coinsReversed: {
            $sum: { $cond: [{ $eq: ['$type', 'COIN_REVERSAL'] }, '$coins', 0] },
          },
          adminCredit: {
            $sum: { $cond: [{ $eq: ['$type', 'ADMIN_CREDIT'] }, '$coins', 0] },
          },
          adminDebit: {
            $sum: { $cond: [{ $eq: ['$type', 'ADMIN_DEBIT'] }, '$coins', 0] },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    return rows.map((r) => {
      const credits = r.coinsEarned + r.coinsRefunded + r.coinsReversed + r.adminCredit;
      const debits = r.coinsRedeemed + r.adminDebit;
      let label: string;
      switch (granularity) {
        case 'weekly':
          label = `${r._id.year}-W${String(r._id.week).padStart(2, '0')}`;
          break;
        case 'monthly':
          label = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
          break;
        case 'yearly':
          label = `${r._id.year}`;
          break;
        default:
          label = `${r._id.year}-${String(r._id.month).padStart(2, '0')}-${String(r._id.day).padStart(2, '0')}`;
      }
      return {
        date: label,
        coinsEarned: r.coinsEarned,
        coinsRedeemed: r.coinsRedeemed,
        coinsRefunded: r.coinsRefunded,
        coinsReversed: r.coinsReversed,
        adminCredit: r.adminCredit,
        adminDebit: r.adminDebit,
        netFlow: credits - debits,
      };
    });
  }

  async findAdminLogs(
    page: number,
    limit: number,
  ): Promise<{ logs: AdminLogDto[]; total: number }> {
    const match = { type: { $in: ['ADMIN_CREDIT', 'ADMIN_DEBIT'] } };
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      FelboCoinTransactionModel.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'admins',
            localField: 'adminId',
            foreignField: '_id',
            as: 'admin',
          },
        },
        { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            userId: 1,
            userName: '$user.name',
            userPhone: '$user.phone',
            adminId: 1,
            adminName: '$admin.name',
            type: 1,
            direction: 1,
            coins: 1,
            balanceBefore: 1,
            balanceAfter: 1,
            description: 1,
            createdAt: 1,
          },
        },
      ]),
      FelboCoinTransactionModel.countDocuments(match),
    ]);

    return {
      logs: rows.map((r) => ({
        id: r._id.toString(),
        userId: r.userId.toString(),
        userName: r.userName ?? 'Unknown',
        userPhone: r.userPhone ?? '',
        adminId: r.adminId?.toString() ?? '',
        adminName: r.adminName ?? 'Unknown Admin',
        type: r.type as 'ADMIN_CREDIT' | 'ADMIN_DEBIT',
        direction: r.direction,
        coins: r.coins,
        balanceBefore: r.balanceBefore,
        balanceAfter: r.balanceAfter,
        description: r.description,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  async findUsersLeaderboard(
    page: number,
    limit: number,
  ): Promise<{ users: CoinUserLeaderboardItemDto[]; total: number }> {
    const query = { status: { $ne: 'DELETED' }, felboCoinBalance: { $gt: 0 } };
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .sort({ felboCoinBalance: -1 })
        .skip(skip)
        .limit(limit)
        .select('_id name phone email felboCoinBalance')
        .lean()
        .exec(),
      UserModel.countDocuments(query).exec(),
    ]);

    return {
      users: users.map((u) => ({
        userId: u._id.toString(),
        name: u.name ?? '',
        phone: u.phone,
        email: u.email ?? null,
        felboCoinBalance: u.felboCoinBalance,
      })),
      total,
    };
  }
}
