import { Request, Response } from 'express';
import { BookingService } from './booking.service';
import { shopIdParamSchema, getSlotsQuerySchema } from './booking.validators';

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
}
