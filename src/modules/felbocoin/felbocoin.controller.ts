import { Request, Response } from 'express';
import { FelboCoinService } from './felbocoin.service';
import {
  adminCoinActionSchema,
  adminLeaderboardQuerySchema,
  adminLogsQuerySchema,
  adminStatsQuerySchema,
  adminTransactionsQuerySchema,
  adminTrendQuerySchema,
  felboCoinTransactionsQuerySchema,
  userIdParamSchema,
} from './felbocoin.validators';

export class FelboCoinController {
  constructor(private readonly felboCoinService: FelboCoinService) {}

  getFelboCoin = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub;
    const { page, limit } = felboCoinTransactionsQuerySchema.parse(req.query);
    const result = await this.felboCoinService.getFelboCoinOverview(userId, page, limit);
    res.json({ success: true, data: result });
  };

  adminCreditCoins = async (req: Request, res: Response): Promise<void> => {
    const { userId } = userIdParamSchema.parse(req.params);
    const { coins, reason } = adminCoinActionSchema.parse(req.body);
    const adminId = req.user!.sub;

    await this.felboCoinService.adminCreditCoins({ adminId, userId, coins, reason });

    res.status(200).json({ success: true, message: `${coins} coin(s) credited to user.` });
  };

  adminDebitCoins = async (req: Request, res: Response): Promise<void> => {
    const { userId } = userIdParamSchema.parse(req.params);
    const { coins, reason } = adminCoinActionSchema.parse(req.body);
    const adminId = req.user!.sub;

    await this.felboCoinService.adminDebitCoins({ adminId, userId, coins, reason });

    res.status(200).json({ success: true, message: `${coins} coin(s) debited from user.` });
  };

  getAdminCoinStats = async (req: Request, res: Response): Promise<void> => {
    const { from, to } = adminStatsQuerySchema.parse(req.query);
    const result = await this.felboCoinService.getAdminCoinStats(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    res.json({ success: true, data: result });
  };

  getAllTransactions = async (req: Request, res: Response): Promise<void> => {
    const { page, limit, search, type, direction, from, to } = adminTransactionsQuerySchema.parse(
      req.query,
    );
    const result = await this.felboCoinService.getAllTransactions(
      {
        search,
        type,
        direction,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      },
      page,
      limit,
    );
    res.json({ success: true, data: result });
  };

  getCoinTrend = async (req: Request, res: Response): Promise<void> => {
    const { from, to, granularity } = adminTrendQuerySchema.parse(req.query);
    const result = await this.felboCoinService.getCoinTrend(
      new Date(from),
      new Date(to),
      granularity,
    );
    res.json({ success: true, data: result });
  };

  getUsersLeaderboard = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = adminLeaderboardQuerySchema.parse(req.query);
    const result = await this.felboCoinService.getUsersLeaderboard(page, limit);
    res.json({ success: true, data: result });
  };

  getAdminLogs = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = adminLogsQuerySchema.parse(req.query);
    const result = await this.felboCoinService.getAdminLogs(page, limit);
    res.json({ success: true, data: result });
  };
}
