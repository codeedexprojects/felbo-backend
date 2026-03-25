import { NotificationModel, INotification, NotificationRecipientRole } from './notification.model';

export interface CreateNotificationData {
  recipientId: string;
  recipientRole: NotificationRecipientRole;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class NotificationRepository {
  async create(input: CreateNotificationData): Promise<INotification> {
    return NotificationModel.create(input);
  }

  async findByRecipient(
    recipientId: string,
    recipientRole: NotificationRecipientRole,
    limit: number,
    cursor?: string, // createdAt of last seen doc (for cursor pagination)
  ): Promise<INotification[]> {
    const query: Record<string, unknown> = { recipientId, recipientRole };
    if (cursor) {
      query['createdAt'] = { $lt: new Date(cursor) };
    }
    return NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<INotification[]>()
      .exec();
  }

  async countUnread(
    recipientId: string,
    recipientRole: NotificationRecipientRole,
  ): Promise<number> {
    return NotificationModel.countDocuments({ recipientId, recipientRole, isRead: false }).exec();
  }

  async markAllRead(recipientId: string, recipientRole: NotificationRecipientRole): Promise<void> {
    await NotificationModel.updateMany(
      { recipientId, recipientRole, isRead: false },
      { $set: { isRead: true } },
    ).exec();
  }

  async markOneRead(id: string, recipientId: string): Promise<INotification | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, recipientId },
      { $set: { isRead: true } },
      { returnDocument: 'after' },
    ).exec();
  }
}
