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

export interface FcmPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  android?: {
    priority?: 'high' | 'normal';
    sound?: string;
  };
}

export interface FcmResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[]; // tokens to remove from DB
}

export async function sendFcmNotification(payload: FcmPayload): Promise<FcmResult> {
  if (!payload.tokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

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
        priority: payload.android?.priority ?? 'high',
        notification: {
          sound: payload.android?.sound ?? 'default',
          channelId: 'felbo_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
      data: {
        ...payload.data,
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
            logger.warn('FCM send error (non-fatal)', { code: errCode, token: chunk[idx] });
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
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
