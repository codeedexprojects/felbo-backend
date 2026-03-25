import { NotificationRepository } from './notification.repository';
import {
  NotificationDto,
  ListNotificationsResponse,
  SaveNotificationInput,
} from './notification.types';
import { INotification, NotificationRecipientRole } from './notification.model';
import { NotFoundError } from '@shared/errors';
import {
  enqueueBookingConfirmedUser,
  enqueueNewBookingVendor,
} from '@shared/notification/notification.queue';

const DEFAULT_PAGE_SIZE = 20;

export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  async save(input: SaveNotificationInput): Promise<void> {
    await this.repo.create(input);
  }

  async sendTestNotification(userId: string, barberId: string): Promise<void> {
    const now = new Date();
    const appointmentTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const testBookingId = 'test-booking-id';
    const testShopName = 'Test Shop';

    await Promise.all([
      enqueueBookingConfirmedUser({
        userId,
        shopName: testShopName,
        appointmentTime,
        bookingId: testBookingId,
      }),
      enqueueNewBookingVendor({
        barberId,
        customerName: 'Test User',
        serviceName: 'Test Service',
        appointmentTime,
      }),
      this.repo.create({
        recipientId: userId,
        recipientRole: 'user',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed!',
        body: `Your booking at ${testShopName} is confirmed for ${appointmentTime}`,
        data: { bookingId: testBookingId, shopName: testShopName },
      }),
      this.repo.create({
        recipientId: barberId,
        recipientRole: 'barber',
        type: 'NEW_BOOKING',
        title: 'New Booking from Test User',
        body: `Test Service at ${appointmentTime}`,
        data: { customerName: 'Test User', serviceName: 'Test Service', appointmentTime },
      }),
    ]);
  }

  async listForUser(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    cursor?: string,
  ): Promise<ListNotificationsResponse> {
    return this.listForRecipient(userId, 'user', limit, cursor);
  }

  async listForBarber(
    barberId: string,
    limit = DEFAULT_PAGE_SIZE,
    cursor?: string,
  ): Promise<ListNotificationsResponse> {
    return this.listForRecipient(barberId, 'barber', limit, cursor);
  }

  async getUnreadCountForUser(userId: string): Promise<number> {
    return this.repo.countUnread(userId, 'user');
  }

  async markAllReadForUser(userId: string): Promise<void> {
    await this.repo.markAllRead(userId, 'user');
  }

  async markAllReadForBarber(barberId: string): Promise<void> {
    await this.repo.markAllRead(barberId, 'barber');
  }

  async markOneReadForUser(id: string, userId: string): Promise<NotificationDto> {
    return this.markOneRead(id, userId);
  }

  async markOneReadForBarber(id: string, barberId: string): Promise<NotificationDto> {
    return this.markOneRead(id, barberId);
  }

  private async listForRecipient(
    recipientId: string,
    recipientRole: NotificationRecipientRole,
    limit: number,
    cursor?: string,
  ): Promise<ListNotificationsResponse> {
    const [notifications, unreadCount] = await Promise.all([
      this.repo.findByRecipient(recipientId, recipientRole, limit + 1, cursor),
      this.repo.countUnread(recipientId, recipientRole),
    ]);

    const hasMore = notifications.length > limit;
    const page = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

    return {
      notifications: page.map(this.toDto),
      unreadCount,
      nextCursor,
    };
  }

  private async markOneRead(id: string, recipientId: string): Promise<NotificationDto> {
    const updated = await this.repo.markOneRead(id, recipientId);
    if (!updated) throw new NotFoundError('Notification not found.');
    return this.toDto(updated);
  }

  private toDto(n: INotification): NotificationDto {
    return {
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data as Record<string, string>,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }
}
