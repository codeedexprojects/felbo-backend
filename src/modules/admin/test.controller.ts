import { Request, Response } from 'express';
import * as NotificationQueue from '../../shared/notification/notification.queue';

export class TestController {
  testBookingConfirmed = async (req: Request, res: Response): Promise<void> => {
    const { userId, barberId } = req.body;

    if (!userId || !barberId) {
      res
        .status(400)
        .json({ success: false, message: 'Both userId and barberId are required in the payload.' });
      return;
    }

    try {
      await NotificationQueue.enqueueBookingConfirmedUser({
        userId,
        shopName: 'Test Barber Shop',
        appointmentTime: '10:00 AM',
        bookingId: 'TEST-BOOKING-1234',
      });

      res.status(200).json({
        success: true,
        message: `Successfully enqueued BOOKING_CONFIRMED_USER and NEW_BOOKING_VENDOR for userId: ${userId} and barberId: ${barberId}`,
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to enqueue test notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

export const testController = new TestController();
