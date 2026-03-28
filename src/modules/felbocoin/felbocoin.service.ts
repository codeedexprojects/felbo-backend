import { Logger } from 'winston';
import { ClientSession, withTransaction } from '../../shared/database/transaction';
import { ValidationError, NotFoundError } from '../../shared/errors';
import UserRepository from '../user/user.repository';
import { FelboCoinRepository } from './felbocoin.repository';
import {
  AdminCoinStatsDto,
  AdminCreditCoinsInput,
  AdminDebitCoinsInput,
  AdminLogListDto,
  AdminTransactionListDto,
  CoinTrendBucketDto,
  CoinUserLeaderboardDto,
  CreditCoinsInput,
  DebitCoinsInput,
  FelboCoinOverviewDto,
  FelboCoinTransactionDto,
} from './felbocoin.types';

export class FelboCoinService {
  constructor(
    private readonly felboCoinRepository: FelboCoinRepository,
    private readonly getUserRepository: () => UserRepository,
    private readonly logger: Logger,
  ) {}

  private get userRepository(): UserRepository {
    return this.getUserRepository();
  }

  async creditCoins(input: CreditCoinsInput, session?: ClientSession): Promise<void> {
    const runCredit = async (s: ClientSession) => {
      const updatedUser = await this.userRepository.incrementCoinBalance(
        input.userId,
        input.coins,
        s,
      );
      if (!updatedUser) throw new NotFoundError('User not found.');

      // balanceAfter is the value MongoDB committed; derive before from it — no stale read
      const balanceAfter = updatedUser.felboCoinBalance;
      const balanceBefore = balanceAfter - input.coins;

      await this.felboCoinRepository.createTransaction(
        {
          userId: input.userId,
          type: input.type,
          direction: 'CREDIT',
          coins: input.coins,
          balanceBefore,
          balanceAfter,
          bookingId: input.bookingId,
          bookingNumber: input.bookingNumber,
          description: input.description,
        },
        s,
      );
    };

    if (session) {
      await runCredit(session);
    } else {
      await withTransaction(runCredit);
    }

    this.logger.info({
      action: 'COINS_CREDITED',
      module: 'felbocoin',
      userId: input.userId,
      type: input.type,
      coins: input.coins,
    });
  }

  async debitCoins(input: DebitCoinsInput, session?: ClientSession): Promise<void> {
    const runDebit = async (s: ClientSession) => {
      const updatedUser = await this.userRepository.decrementCoinBalance(
        input.userId,
        input.coins,
        s,
      );

      if (!updatedUser) {
        // Distinguish "not found" vs "insufficient balance" for a helpful error message
        const exists = await this.userRepository.findById(input.userId);
        if (!exists) throw new NotFoundError('User not found.');
        throw new ValidationError('Insufficient FelboCoin balance.');
      }

      // balanceAfter is the value MongoDB committed
      const balanceAfter = updatedUser.felboCoinBalance;
      const balanceBefore = balanceAfter + input.coins;

      await this.felboCoinRepository.createTransaction(
        {
          userId: input.userId,
          type: input.type,
          direction: 'DEBIT',
          coins: input.coins,
          balanceBefore,
          balanceAfter,
          bookingId: input.bookingId,
          bookingNumber: input.bookingNumber,
          description: input.description,
        },
        s,
      );
    };

    if (session) {
      await runDebit(session);
    } else {
      await withTransaction(runDebit);
    }

    this.logger.info({
      action: 'COINS_DEBITED',
      module: 'felbocoin',
      userId: input.userId,
      type: input.type,
      coins: input.coins,
    });
  }

  async getFelboCoinOverview(
    userId: string,
    page: number,
    limit: number,
  ): Promise<FelboCoinOverviewDto> {
    const [user, { transactions, total }] = await Promise.all([
      this.userRepository.findById(userId),
      this.felboCoinRepository.findByUserId(userId, page, limit),
    ]);

    if (!user) throw new NotFoundError('User not found.');

    return {
      totalCoins: user.felboCoinBalance,
      transactions: transactions.map((t) => this.mapTransaction(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminGetFelboCoinOverview(
    userId: string,
    page: number,
    limit: number,
  ): Promise<FelboCoinOverviewDto> {
    return this.getFelboCoinOverview(userId, page, limit);
  }

  async adminCreditCoins(input: AdminCreditCoinsInput): Promise<void> {
    await withTransaction(async (session) => {
      const updatedUser = await this.userRepository.incrementCoinBalance(
        input.userId,
        input.coins,
        session,
      );
      if (!updatedUser) throw new NotFoundError('User not found.');

      const balanceAfter = updatedUser.felboCoinBalance;
      const balanceBefore = balanceAfter - input.coins;

      await this.felboCoinRepository.createTransaction(
        {
          userId: input.userId,
          type: 'ADMIN_CREDIT',
          direction: 'CREDIT',
          coins: input.coins,
          balanceBefore,
          balanceAfter,
          adminId: input.adminId,
          description: input.reason,
        },
        session,
      );
    });

    this.logger.info({
      action: 'ADMIN_COINS_CREDITED',
      module: 'felbocoin',
      adminId: input.adminId,
      userId: input.userId,
      coins: input.coins,
    });
  }

  async adminDebitCoins(input: AdminDebitCoinsInput): Promise<void> {
    await withTransaction(async (session) => {
      const updatedUser = await this.userRepository.decrementCoinBalance(
        input.userId,
        input.coins,
        session,
      );

      if (!updatedUser) {
        const exists = await this.userRepository.findById(input.userId);
        if (!exists) throw new NotFoundError('User not found.');
        throw new ValidationError('Insufficient FelboCoin balance.');
      }

      const balanceAfter = updatedUser.felboCoinBalance;
      const balanceBefore = balanceAfter + input.coins;

      await this.felboCoinRepository.createTransaction(
        {
          userId: input.userId,
          type: 'ADMIN_DEBIT',
          direction: 'DEBIT',
          coins: input.coins,
          balanceBefore,
          balanceAfter,
          adminId: input.adminId,
          description: input.reason,
        },
        session,
      );
    });

    this.logger.info({
      action: 'ADMIN_COINS_DEBITED',
      module: 'felbocoin',
      adminId: input.adminId,
      userId: input.userId,
      coins: input.coins,
    });
  }

  async getAdminCoinStats(from?: Date, to?: Date): Promise<AdminCoinStatsDto> {
    return this.felboCoinRepository.getStats(from, to);
  }

  async getAllTransactions(
    filters: {
      search?: string;
      type?: string;
      direction?: string;
      from?: Date;
      to?: Date;
    },
    page: number,
    limit: number,
  ): Promise<AdminTransactionListDto> {
    const { transactions, total } = await this.felboCoinRepository.findAllWithFilters(
      filters as Parameters<FelboCoinRepository['findAllWithFilters']>[0],
      page,
      limit,
    );
    return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCoinTrend(
    from: Date,
    to: Date,
    granularity: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ): Promise<CoinTrendBucketDto[]> {
    return this.felboCoinRepository.getTrend(from, to, granularity);
  }

  async getUsersLeaderboard(page: number, limit: number): Promise<CoinUserLeaderboardDto> {
    const { users, total } = await this.felboCoinRepository.findUsersLeaderboard(page, limit);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAdminLogs(page: number, limit: number): Promise<AdminLogListDto> {
    const { logs, total } = await this.felboCoinRepository.findAdminLogs(page, limit);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private mapTransaction(t: {
    type: string;
    direction: string;
    coins: number;
    description: string;
    createdAt: Date;
  }): FelboCoinTransactionDto {
    return {
      type: t.type as FelboCoinTransactionDto['type'],
      direction: t.direction as FelboCoinTransactionDto['direction'],
      coins: t.coins,
      description: t.description,
      date: t.createdAt,
    };
  }
}
