import { IssueRepository } from './issue.repository';
import { IssueService } from './issue.service';
import { IssueController } from './issue.controller';
import { vendorService } from '../vendor/vendor.container';
import { shopService } from '../shop/shop.container';
import { bookingService } from '../booking/booking.container';
import { configService } from '../config/config.container';

const issueRepository = new IssueRepository();
const issueService = new IssueService(
  issueRepository,
  () => vendorService,
  () => shopService,
  () => bookingService,
  configService,
);
const issueController = new IssueController(issueService);

export { issueService, issueController };
