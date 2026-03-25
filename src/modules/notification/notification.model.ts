import mongoose, { Schema, Document } from 'mongoose';

export type NotificationRecipientRole = 'user' | 'barber';

export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED_BY_VENDOR'
  | 'BOOKING_CANCELLED_BY_USER'
  | 'BOOKING_CANCELLED_BY_CUSTOMER'
  | 'NEW_BOOKING'
  | 'REMINDER'
  | 'REVIEW_PROMPT'
  | 'VENDOR_WARNING'
  | 'VENDOR_SUSPENDED'
  | 'VENDOR_REACTIVATED';

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  recipientRole: NotificationRecipientRole;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, required: true, index: true },
    recipientRole: { type: String, enum: ['user', 'barber'], required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Map, of: String, default: {} },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Compound index for the primary query pattern: fetch unread for a recipient
notificationSchema.index({ recipientId: 1, recipientRole: 1, createdAt: -1 });

// TTL: auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15 * 24 * 60 * 60 });

export const NotificationModel = mongoose.model<INotification>('Notification', notificationSchema);
