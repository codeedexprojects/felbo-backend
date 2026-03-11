import { Request, Response } from 'express';
import { BookingService } from './booking.service';
import {
  shopIdParamSchema,
  getSlotsQuerySchema,
  initiateBookingBodySchema,
  bookingIdParamSchema,
  confirmBookingBodySchema,
  adminBookingListQuerySchema,
} from './booking.validators';

import VendorService from '../vendor/vendor.service';
import ShopService from '../shop/shop.service';

export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly vendorService: VendorService,
    private readonly shopService: ShopService,
  ) {}

  getSlots = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const query = getSlotsQuerySchema.parse(req.query);

    const serviceIds = query.serviceIds.split(',').map((id) => id.trim());

    const result = await this.bookingService.getSlots({
      shopId,
      date: query.date,
      serviceIds,
      barberId: query.barberId,
    });

    res.json({ success: true, data: result });
  };

  initiateBooking = async (req: Request, res: Response): Promise<void> => {
    const body = initiateBookingBodySchema.parse(req.body);
    const userId = req.user!.sub;

    const result = await this.bookingService.initiateBooking(body, userId);

    res.status(201).json({ success: true, data: result });
  };

  confirmBooking = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const body = confirmBookingBodySchema.parse(req.body);
    const userId = req.user!.sub;

    const result = await this.bookingService.confirmBooking(bookingId, body, userId);

    res.json({ success: true, data: result });
  };

  adminGetBookings = async (req: Request, res: Response): Promise<void> => {
    const query = adminBookingListQuerySchema.parse(req.query);
    const role = req.user!.role;
    let associatedShopIds: string[] | undefined;

    if (role === 'ASSOCIATION_ADMIN') {
      const vendorIds = await this.vendorService.getAssociationVendorIds();
      associatedShopIds = await this.shopService.getShopIdsByVendorIds(vendorIds.map(String));
    }

    const result = await this.bookingService.adminGetBookings({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      associatedShopIds,
      role,
    });

    res.status(200).json({ success: true, data: result });
  };

  adminGetBookingDetail = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const role = req.user!.role;
    let associatedShopIds: string[] | undefined;

    if (role === 'ASSOCIATION_ADMIN') {
      const vendorIds = await this.vendorService.getAssociationVendorIds();
      associatedShopIds = await this.shopService.getShopIdsByVendorIds(vendorIds.map(String));
    }

    const result = await this.bookingService.adminGetBookingDetail(
      bookingId,
      role,
      associatedShopIds,
    );

    res.status(200).json({ success: true, data: result });
  };
}
