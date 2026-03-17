import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { vendorService } from '../vendor/vendor.container';
import { shopService } from '../shop/shop.container';

const financeRepository = new FinanceRepository();

const financeService = new FinanceService(
  financeRepository,
  () => vendorService,
  () => shopService,
);

const financeController = new FinanceController(financeService);

export { financeService, financeController };
