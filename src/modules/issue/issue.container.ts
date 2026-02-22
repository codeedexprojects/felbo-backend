import { IssueRepository } from './issue.repository';
import { IssueService } from './issue.service';
import { IssueController } from './issue.controller';

const issueRepository = new IssueRepository();
export const issueService = new IssueService(issueRepository);
export const issueController = new IssueController(issueService);
