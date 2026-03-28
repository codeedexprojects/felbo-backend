import { Request, Response } from 'express';
import { IssueService } from './issue.service';
import {
  listIssuesSchema,
  issueIdParamSchema,
  updateIssueStatusSchema,
  createIssueSchema,
  userIssueListQuerySchema,
} from './issue.validators';

export class IssueController {
  constructor(private readonly issueService: IssueService) {}

  createIssue = async (req: Request, res: Response): Promise<void> => {
    const validated = createIssueSchema.parse(req.body);
    const userId = req.user!.sub;

    const issue = await this.issueService.createIssue(validated, userId);

    res.status(201).json({ success: true, data: issue });
  };

  getIssue = async (req: Request, res: Response): Promise<void> => {
    const { id } = issueIdParamSchema.parse(req.params);
    const issue = await this.issueService.getIssueById(id);
    res.status(200).json({ success: true, data: issue });
  };

  updateIssueStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = issueIdParamSchema.parse(req.params);
    const validated = updateIssueStatusSchema.parse(req.body);
    const adminId = req.user!.sub;

    await this.issueService.updateIssueStatus(
      id,
      { status: validated.status, reason: validated.reason },
      adminId,
    );

    res.status(200).json({
      success: true,
      message: `Issue ${validated.status.toLowerCase()} successfully.`,
    });
  };

  processRefund = async (req: Request, res: Response): Promise<void> => {
    const { id } = issueIdParamSchema.parse(req.params);

    await this.issueService.processRefund(id);

    res.status(200).json({ success: true, message: 'Refund of ₹10 initiated successfully.' });
  };

  flagVendorForIssue = async (req: Request, res: Response): Promise<void> => {
    const { id } = issueIdParamSchema.parse(req.params);

    const { alreadyFlagged } = await this.issueService.flagVendorForIssue(id);

    const message = alreadyFlagged ? 'Vendor is already flagged.' : 'Vendor flagged successfully.';
    res.status(200).json({ success: true, message });
  };

  listUserIssues = async (req: Request, res: Response): Promise<void> => {
    const { page, limit, status, startDate, endDate } = userIssueListQuerySchema.parse(req.query);
    const userId = req.user!.sub;

    const result = await this.issueService.getUserIssues(
      userId,
      page,
      limit,
      status,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
    );

    res.status(200).json({ success: true, data: result });
  };

  listIssues = async (req: Request, res: Response): Promise<void> => {
    const validated = listIssuesSchema.parse(req.query);

    const result = await this.issueService.listIssues({
      page: validated.page,
      limit: validated.limit,
      status: validated.status,
      type: validated.type,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
