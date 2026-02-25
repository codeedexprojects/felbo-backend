import { AdvertisementRepository } from './advertisement.repository';
import { AdvertisementService } from './advertisement.service';
import { AdvertisementController } from './advertisement.controller';
import { shopService } from '../shop/shop.container';

const advertisementRepository = new AdvertisementRepository();
const advertisementService = new AdvertisementService(advertisementRepository, shopService);
const advertisementController = new AdvertisementController(advertisementService);

export { advertisementController };
