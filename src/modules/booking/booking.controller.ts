import { Request, Response } from 'express';
import { BookingService } from './booking.service';
import {
  shopIdParamSchema,
  getSlotsQuerySchema,
  initiateBookingBodySchema,
  bookingIdParamSchema,
  confirmBookingBodySchema,
} from './booking.validators';

export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

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
}
