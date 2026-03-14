import { Request, Response } from 'express';
import { FelboCoinService } from './felbocoin.service';
import { felboCoinTransactionsQuerySchema } from './felbocoin.validators';

export class FelboCoinController {
  constructor(private readonly felboCoinService: FelboCoinService) {}

  getFelboCoin = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub;
    const { page, limit } = felboCoinTransactionsQuerySchema.parse(req.query);
    const result = await this.felboCoinService.getFelboCoinOverview(userId, page, limit);
    res.json({ success: true, data: result });
  };
}
