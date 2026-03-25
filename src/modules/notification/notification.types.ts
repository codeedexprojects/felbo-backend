import { NotificationRecipientRole, NotificationType } from './notification.model';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: Date;
}

export interface ListNotificationsResponse {
  notifications: NotificationDto[];
  unreadCount: number;
  nextCursor: string | null;
}

export interface SaveNotificationInput {
  recipientId: string;
  recipientRole: NotificationRecipientRole;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
