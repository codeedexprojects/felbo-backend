import { Request, Response } from 'express';
import { z } from 'zod';
import { NotificationService } from './notification.service';
import { listNotificationsSchema, notificationIdParamSchema } from './notification.validators';

const testNotifyBodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  barberId: z.string().min(1, 'barberId is required'),
});

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // Used by both user + barber routes; role is derived from req.user
  listForUser = async (req: Request, res: Response): Promise<void> => {
    const { limit, cursor } = listNotificationsSchema.parse(req.query);
    const userId = req.user!.sub;
    const result = await this.notificationService.listForUser(userId, limit, cursor);
    res.json({ success: true, data: result });
  };

  listForBarber = async (req: Request, res: Response): Promise<void> => {
    const { limit, cursor } = listNotificationsSchema.parse(req.query);
    const barberId = req.user!.sub;
    const result = await this.notificationService.listForBarber(barberId, limit, cursor);
    res.json({ success: true, data: result });
  };

  markAllReadForUser = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub;
    await this.notificationService.markAllReadForUser(userId);
    res.json({ success: true, message: 'All notifications marked as read.' });
  };

  markAllReadForBarber = async (req: Request, res: Response): Promise<void> => {
    const barberId = req.user!.sub;
    await this.notificationService.markAllReadForBarber(barberId);
    res.json({ success: true, message: 'All notifications marked as read.' });
  };

  markOneReadForUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = notificationIdParamSchema.parse(req.params);
    const userId = req.user!.sub;
    const notification = await this.notificationService.markOneReadForUser(id, userId);
    res.json({ success: true, data: notification });
  };

  markOneReadForBarber = async (req: Request, res: Response): Promise<void> => {
    const { id } = notificationIdParamSchema.parse(req.params);
    const barberId = req.user!.sub;
    const notification = await this.notificationService.markOneReadForBarber(id, barberId);
    res.json({ success: true, data: notification });
  };

  sendTestNotification = async (req: Request, res: Response): Promise<void> => {
    const { userId, barberId } = testNotifyBodySchema.parse(req.body);
    await this.notificationService.sendTestNotification(userId, barberId);
    res.json({ success: true, message: 'Test notifications sent and persisted.' });
  };
}
