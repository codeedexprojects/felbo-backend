import { Request, Response } from 'express';
import { BookingService } from './booking.service';
import { ForbiddenError } from '../../shared/errors/index';
import { parseDateAsIst } from '../../shared/utils/time';
import {
  shopIdParamSchema,
  getSlotsQuerySchema,
  getBarbersForServicesQuerySchema,
  initiateBookingBodySchema,
  bookingIdParamSchema,
  confirmBookingBodySchema,
  adminBookingListQuerySchema,
  cancelBookingByBarberBodySchema,
  cancelBookingByUserBodySchema,
  barberBookingListQuerySchema,
  completeBookingBodySchema,
  userBookingListQuerySchema,
} from './booking.validators';

export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  private getBarberId(req: Request): string {
    const user = req.user!;
    if (user.role === 'BARBER') {
      return user.sub;
    }
    if (user.role === 'VENDOR_BARBER') {
      if (!user.barberId) {
        throw new ForbiddenError('Barber profile not found in token.');
      }
      return user.barberId;
    }
    throw new ForbiddenError('Access denied.');
  }

  getBarbersForServices = async (req: Request, res: Response): Promise<void> => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const { serviceIds: rawServiceIds } = getBarbersForServicesQuerySchema.parse(req.query);

    const serviceIds = rawServiceIds.split(',').map((id) => id.trim());
    const result = await this.bookingService.getBarbersForServices(
      shopId,
      serviceIds,
      req.user!.sub,
    );

    res.json({ success: true, data: result });
  };

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

    const result = await this.bookingService.adminGetBookings({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      role,
    });

    res.status(200).json({ success: true, data: result });
  };

  adminGetBookingDetail = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const role = req.user!.role;

    const result = await this.bookingService.adminGetBookingDetail(bookingId, role);

    res.status(200).json({ success: true, data: result });
  };

  cancelBookingByBarber = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const body = cancelBookingByBarberBodySchema.parse(req.body);
    const barberId = this.getBarberId(req);

    const result = await this.bookingService.cancelBookingByBarber(
      bookingId,
      body.reason,
      barberId,
    );

    res.json({ success: true, data: result });
  };

  getBarberBookings = async (req: Request, res: Response): Promise<void> => {
    const query = barberBookingListQuerySchema.parse(req.query);
    const barberId = this.getBarberId(req);

    const startDate = query.startDate ? parseDateAsIst(query.startDate) : undefined;
    const endDate = query.endDate
      ? new Date(parseDateAsIst(query.endDate).getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    const result = await this.bookingService.getBarberBookings(
      barberId,
      query.page,
      query.limit,
      query.status,
      startDate,
      endDate,
    );

    res.json({ success: true, data: result });
  };

  getBarberBookingDetail = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const barberId = this.getBarberId(req);

    const result = await this.bookingService.getBarberBookingDetail(bookingId, barberId);

    res.json({ success: true, data: result });
  };

  cancelBookingByUser = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const body = cancelBookingByUserBodySchema.parse(req.body);
    const userId = req.user!.sub;

    const result = await this.bookingService.cancelBookingByUser(bookingId, body.reason, userId);

    res.json({ success: true, data: result });
  };

  completeBooking = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const { verificationCode } = completeBookingBodySchema.parse(req.body);
    const barberId = this.getBarberId(req);

    const result = await this.bookingService.completeBooking(bookingId, barberId, verificationCode);

    res.json({ success: true, data: result });
  };

  getBarberDashboard = async (req: Request, res: Response): Promise<void> => {
    const barberId = this.getBarberId(req);
    const result = await this.bookingService.getBarberDashboardStats(barberId);
    res.json({ success: true, data: result });
  };

  getBarberTodayConfirmed = async (req: Request, res: Response): Promise<void> => {
    const barberId = this.getBarberId(req);
    const result = await this.bookingService.getBarberTodayConfirmed(barberId);
    res.json({ success: true, data: result });
  };

  getUserBookingsList = async (req: Request, res: Response): Promise<void> => {
    const { tab, page, limit, startDate, endDate } = userBookingListQuerySchema.parse(req.query);
    const userId = req.user!.sub;

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined;

    const result = await this.bookingService.getUserBookingsList(
      userId,
      tab,
      page,
      limit,
      start,
      end,
    );

    res.json({ success: true, data: result });
  };

  getUserBookingDetail = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const userId = req.user!.sub;

    const result = await this.bookingService.getUserBookingDetail(userId, bookingId);

    res.json({ success: true, data: result });
  };
}
