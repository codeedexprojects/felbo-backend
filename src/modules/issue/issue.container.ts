import { IssueRepository } from './issue.repository';
import { IssueService } from './issue.service';
import { IssueController } from './issue.controller';
import { vendorService } from '../vendor/vendor.container';
import { shopService } from '../shop/shop.container';
import { paymentService } from '../payment/payment.container';

const issueRepository = new IssueRepository();
export const issueService = new IssueService(
  issueRepository,
  vendorService,
  shopService,
  paymentService,
);
export const issueController = new IssueController(issueService);
