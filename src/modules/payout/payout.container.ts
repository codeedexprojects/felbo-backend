import { PayoutRepository } from './payout.repository';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { vendorService } from '../vendor/vendor.container';
import { shopService } from '../shop/shop.container';

const payoutRepository = new PayoutRepository();

const payoutService = new PayoutService(
  payoutRepository,
  () => vendorService,
  () => shopService,
);

const payoutController = new PayoutController(payoutService);

export { payoutService, payoutController };
