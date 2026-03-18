import { Router } from 'express';
import { shopController } from '../../modules/shop/shop.container';
import { bookingController } from '../../modules/booking/booking.container';

const router = Router();

router.get('/:id/details', shopController.getShopDetails);
router.get('/:id/services', shopController.getShopServices);
router.get('/:shopId/barbers', bookingController.getBarbersForServices);
router.get('/:shopId/slots', bookingController.getSlots);

export default router;
