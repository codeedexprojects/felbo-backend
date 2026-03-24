// scripts/inspect-queue.ts
import { Queue } from 'bullmq';
import { getBullConnection, QUEUE_NAMES } from '../src/shared/queue/bull';

async function inspect() {
  const queue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
    connection: getBullConnection(),
  });

  const [waiting, active, delayed, failed, completed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getDelayed(),
    queue.getFailed(),
    queue.getCompleted(),
  ]);

  console.log('\n=== QUEUE INSPECTION ===\n');

  console.log(`Waiting (${waiting.length}):`);
  waiting.forEach((j) => console.log(`  [${j.id}] ${j.data.jobName}`, JSON.stringify(j.data)));

  console.log(`\nActive (${active.length}):`);
  active.forEach((j) => console.log(`  [${j.id}] ${j.data.jobName}`, JSON.stringify(j.data)));

  console.log(`\nDelayed (${delayed.length}):`);
  delayed.forEach((j) =>
    console.log(
      `  [${j.id}] ${j.data.jobName} — fires in ${Math.round((j.opts.delay! - Date.now()) / 1000)}s`,
    ),
  );

  console.log(`\nFailed (${failed.length}):`);
  failed.forEach((j) => console.log(`  [${j.id}] ${j.data.jobName} — reason: ${j.failedReason}`));

  console.log(`\nCompleted (${completed.length}):`);
  completed.forEach((j) => console.log(`  [${j.id}] ${j.data.jobName}`));

  await queue.close();
}

inspect()
  .catch(console.error)
  .finally(() => process.exit(0));
