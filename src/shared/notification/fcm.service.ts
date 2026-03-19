import admin from 'firebase-admin';
import { config } from '../config/config.service';
import { logger } from '../logger/logger';

let initialized = false;

export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) return;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
      clientEmail: config.firebase.clientEmail,
    }),
  });

  initialized = true;
  logger.info('Firebase Admin SDK initialized');
}

export const FCM_CHANNELS = {
  BOOKING: 'felbo_booking',
  REMINDER: 'felbo_reminder',
  GENERAL: 'felbo_general',
} as const;

export type FcmChannel = (typeof FCM_CHANNELS)[keyof typeof FCM_CHANNELS];

const CHANNEL_SOUNDS: Record<FcmChannel, string> = {
  [FCM_CHANNELS.BOOKING]: 'booking',
  [FCM_CHANNELS.REMINDER]: 'reminder_tone',
  [FCM_CHANNELS.GENERAL]: 'scissors',
};

export interface FcmPayload {
  tokens: string[];
  title: string;
  body: string;
  channel: FcmChannel;
  data?: Record<string, string>;
}

export interface FcmResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export async function sendFcmNotification(payload: FcmPayload): Promise<FcmResult> {
  if (!payload.tokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const sound = CHANNEL_SOUNDS[payload.channel];
  const chunks = chunkArray(payload.tokens, 500);
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    const message: admin.messaging.MulticastMessage = {
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      android: {
        priority: payload.channel === FCM_CHANNELS.BOOKING ? 'high' : 'normal',
        notification: {
          channelId: payload.channel,
          sound,
          vibrateTimingsMillis:
            payload.channel === FCM_CHANNELS.BOOKING ? [0, 500, 200, 500, 200, 500] : undefined,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: `${sound}.caf`,
            contentAvailable: true,
            mutableContent: payload.channel === FCM_CHANNELS.BOOKING ? true : undefined,
          },
        },
      },
      data: {
        ...payload.data,
        channel: payload.channel,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(chunk[idx]);
          } else {
            logger.warn('FCM send error (non-fatal)', { code: errCode });
          }
        }
      });
    } catch (err) {
      logger.error('FCM batch send failed', err);
      failureCount += chunk.length;
    }
  }

  return { successCount, failureCount, invalidTokens };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
