import { Request, Response } from 'express';
import { IssueService } from './issue.service';
import { listIssuesSchema, issueIdParamSchema } from './issue.validators';

export class IssueController {
  constructor(private readonly issueService: IssueService) {}

  getIssue = async (req: Request, res: Response): Promise<void> => {
    const { id } = issueIdParamSchema.parse(req.params);
    const issue = await this.issueService.getIssueById(id);
    res.status(200).json({ success: true, data: issue });
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
