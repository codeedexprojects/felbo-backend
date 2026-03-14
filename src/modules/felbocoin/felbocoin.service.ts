import { Logger } from 'winston';
import { ClientSession, withTransaction } from '../../shared/database/transaction';
import { ValidationError, NotFoundError } from '../../shared/errors';
import UserRepository from '../user/user.repository';
import { FelboCoinRepository } from './felbocoin.repository';
import {
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
