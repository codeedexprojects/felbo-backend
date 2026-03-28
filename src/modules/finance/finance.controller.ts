import { Request, Response } from 'express';
import { FinanceService } from './finance.service';
import {
  financeChartSchema,
  financeVendorTableSchema,
  independentRegListSchema,
  refundHistorySchema,
  resolveDateRange,
} from './finance.validators';

export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  getFinanceSummary = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.financeService.getSummary();
    res.status(200).json({ success: true, data: result });
  };

  getRevenueChart = async (req: Request, res: Response): Promise<void> => {
    const validated = financeChartSchema.parse(req.query);
    const { from, to } = resolveDateRange(validated.period, validated.from, validated.to);
    const result = await this.financeService.getRevenueChart(from, to);
    res.status(200).json({ success: true, data: result });
  };

  getVendorRevenueTable = async (req: Request, res: Response): Promise<void> => {
    const validated = financeVendorTableSchema.parse(req.query);
    const { from, to } = resolveDateRange(validated.period, validated.from, validated.to);
    const result = await this.financeService.getVendorRevenueTable({
      from,
      to,
      search: validated.search,
      sortOrder: validated.sortOrder,
      minRevenue: validated.minRevenue,
      maxRevenue: validated.maxRevenue,
      page: validated.page,
      limit: validated.limit,
    });
    res.status(200).json({ success: true, data: result });
  };

  getAssocFinanceSummary = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.financeService.getAssocSummary();
    res.status(200).json({ success: true, data: result });
  };

  getAssocVendorRevenueTable = async (req: Request, res: Response): Promise<void> => {
    const validated = financeVendorTableSchema.parse(req.query);
    const { from, to } = resolveDateRange(validated.period, validated.from, validated.to);
    const result = await this.financeService.getAssocVendorRevenueTable({
      from,
      to,
      search: validated.search,
      sortOrder: validated.sortOrder,
      minRevenue: validated.minRevenue,
      maxRevenue: validated.maxRevenue,
      page: validated.page,
      limit: validated.limit,
    });
    res.status(200).json({ success: true, data: result });
  };

  getIndependentRegistrationList = async (req: Request, res: Response): Promise<void> => {
    const validated = independentRegListSchema.parse(req.query);
    let from: Date | undefined;
    let to: Date | undefined;
    if (validated.from || validated.to) {
      const range = resolveDateRange('custom', validated.from, validated.to);
      from = range.from;
      to = range.to;
    }
    const result = await this.financeService.getIndependentRegistrationList({
      page: validated.page,
      limit: validated.limit,
      search: validated.search,
      from,
      to,
      verificationStatus: validated.verificationStatus,
    });
    res.status(200).json({ success: true, data: result });
  };

  getRefundHistory = async (req: Request, res: Response): Promise<void> => {
    const validated = refundHistorySchema.parse(req.query);
    let from: Date | undefined;
    let to: Date | undefined;
    if (validated.from || validated.to) {
      const range = resolveDateRange('custom', validated.from, validated.to);
      from = range.from;
      to = range.to;
    }
    const result = await this.financeService.getRefundHistory({
      type: validated.type,
      page: validated.page,
      limit: validated.limit,
      from,
      to,
    });
    res.status(200).json({ success: true, data: result });
  };
}
