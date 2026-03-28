import cron from 'node-cron';
import { sendTopicNotification, FCM_CHANNELS } from './fcm.service';
import { logger } from '../logger/logger';

const BARBER_TOPIC = 'barber_app';

export function scheduleBarberAvailabilityCron(): void {
  // Scheduled to run everyday at 8:00 AM IST
  cron.schedule(
    '30 8 * * *',
    async () => {
      logger.info({ action: 'BARBER_AVAILABILITY_CRON_START', module: 'barber' });

      await sendTopicNotification(BARBER_TOPIC, {
        channel: FCM_CHANNELS.REMINDER,
        title: "Set up today's availability",
        body: 'Tap to mark yourself available so customers can book with you today.',
        data: { type: 'REMINDER' },
      });
    },
    { timezone: 'Asia/Kolkata' },
  );

  logger.info({
    action: 'BARBER_AVAILABILITY_CRON_SCHEDULED',
    module: 'barber',
    time: '08:00 IST',
  });
}
