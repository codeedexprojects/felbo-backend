// src/shared/queue/bull-board.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { Express } from 'express';
import { getBullConnection, QUEUE_NAMES } from './bull';

export function setupBullBoard(app: Express): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection: getBullConnection() })),
    ],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());
}
