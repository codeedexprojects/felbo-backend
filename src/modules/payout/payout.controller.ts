import { Request, Response } from 'express';
import { PayoutService } from './payout.service';
import { payoutListSchema, payoutIdParamSchema, rejectPayoutBodySchema } from './payout.validators';

export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  getDashboard = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.payoutService.getDashboard();
    res.status(200).json({ success: true, data: result });
  };

  createPayout = async (req: Request, res: Response): Promise<void> => {
    const adminId = req.user!.sub;
    const result = await this.payoutService.createPayout(adminId);
    res.status(201).json({ success: true, data: result });
  };

  listPayouts = async (req: Request, res: Response): Promise<void> => {
    const validated = payoutListSchema.parse(req.query);
    const result = await this.payoutService.listPayouts({
      status: validated.status,
      page: validated.page,
      limit: validated.limit,
    });
    res.status(200).json({ success: true, data: result });
  };

  getAssocSummary = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.payoutService.getAssocSummary();
    res.status(200).json({ success: true, data: result });
  };

  acceptPayout = async (req: Request, res: Response): Promise<void> => {
    const { id } = payoutIdParamSchema.parse(req.params);
    const adminId = req.user!.sub;
    const result = await this.payoutService.acceptPayout(id, adminId);
    res.status(200).json({ success: true, data: result });
  };

  rejectPayout = async (req: Request, res: Response): Promise<void> => {
    const { id } = payoutIdParamSchema.parse(req.params);
    const { rejectionReason } = rejectPayoutBodySchema.parse(req.body);
    const adminId = req.user!.sub;
    const result = await this.payoutService.rejectPayout(id, adminId, rejectionReason);
    res.status(200).json({ success: true, data: result });
  };
}
