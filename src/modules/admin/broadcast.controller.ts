import { Request, Response } from 'express';
import { broadcastNotificationSchema } from './admin.validators';
import { BroadcastNotificationInput } from './admin.types';
import { sendTopicNotification, FCM_CHANNELS } from '../../shared/notification/fcm.service';
import { logger } from '../../shared/logger/logger';

const AUDIENCE_TOPICS: Record<string, string[]> = {
  users: ['user_app'],
  barbers: ['barber_app'],
  vendors: ['vendor_app'],
  all: ['user_app', 'barber_app', 'vendor_app'],
};

export const broadcastNotification = async (req: Request, res: Response): Promise<void> => {
  const input: BroadcastNotificationInput = broadcastNotificationSchema.parse(req.body);
  const topics = AUDIENCE_TOPICS[input.audience];

  logger.info('Admin broadcast notification initiated', {
    audience: input.audience,
    topics,
    title: input.title,
  });

  await Promise.all(
    topics.map((topic) =>
      sendTopicNotification(topic, {
        title: input.title,
        body: input.body,
        channel: FCM_CHANNELS.GENERAL,
        imageUrl: input.imageUrl,
        data: { type: 'BROADCAST' },
      }),
    ),
  );

  logger.info('Admin broadcast notification sent', { audience: input.audience, topics });

  res.status(200).json({
    success: true,
    message: `Notification broadcast to ${input.audience} (${topics.join(', ')}).`,
  });
};
