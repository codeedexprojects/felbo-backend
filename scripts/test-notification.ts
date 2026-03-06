/**
 * scripts/test-notification.ts
 *
 * End-to-end test for the notification queue + worker pipeline.
 * Does NOT require a real device or real FCM token.
 *
 * What this script does:
 *  1. Seeds a test user and vendor in MongoDB with a FAKE FCM token
 *  2. Enqueues one of every notification job type into BullMQ
 *  3. Waits for the worker to process them
 *  4. Verifies the fake token was pruned (Firebase returns "invalid-token" → worker prunes it)
 *  5. Cleans up test documents
 *
 * Run AFTER starting the notification worker in another terminal:
 *   npm run build && npm run worker:notifications
 *
 * Then run this script:
 *   npx tsx scripts/test-notification.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../src/shared/database/mongo';
import {
  enqueueBookingConfirmedUser,
  enqueueBookingConfirmedVendor,
  enqueueBookingCancelledUser,
  enqueueBookingCancelledVendor,
  enqueueVendorWarning,
  enqueueVendorSuspended,
  enqueueVendorReactivated,
} from '../src/shared/notification/notification.queue';
import { UserModel } from '../src/modules/user/user.model';
import { VendorModel } from '../src/modules/vendor/vendor.model';

// A fake FCM token that Firebase will reject with "invalid-registration-token"
// This is intentional — the worker should prune it after FCM rejects it
const FAKE_FCM_TOKEN = 'FAKE_FCM_TOKEN_test_notification_pipeline_' + Date.now();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function seedTestUser() {
  const user = await UserModel.create({
    name: 'Test User (Notification Test)',
    phone: '9000000001',
    status: 'ACTIVE',
    fcmTokens: [FAKE_FCM_TOKEN],
  });
  console.log(`✅ Seeded test user: ${user._id}`);
  return user;
}

async function seedTestVendor() {
  const vendor = await VendorModel.create({
    ownerName: 'Test Vendor (Notification Test)',
    phone: '9000000002',
    // status defaults to PENDING in the model, but worker's getVendorTokens
    // does not filter by status, so this is fine. Set ACTIVE for clarity.
    status: 'ACTIVE',
    fcmTokens: [FAKE_FCM_TOKEN],
  });
  console.log(`✅ Seeded test vendor: ${vendor._id}`);
  return vendor;
}

async function enqueueAllJobs(userId: string, vendorId: string) {
  console.log('\n📤 Enqueuing all notification job types...\n');

  await enqueueBookingConfirmedUser({
    userId,
    shopName: 'Test Barbershop',
    appointmentTime: '10:30 AM',
  });
  console.log('  → BOOKING_CONFIRMED_USER enqueued');

  await enqueueBookingConfirmedVendor({
    vendorId,
    customerName: 'John Doe',
    serviceName: 'Haircut',
    appointmentTime: '10:30 AM',
  });
  console.log('  → BOOKING_CONFIRMED_VENDOR enqueued (with tts:true)');

  await enqueueBookingCancelledUser({
    userId,
    refundAmount: 199,
  });
  console.log('  → BOOKING_CANCELLED_USER enqueued');

  await enqueueBookingCancelledVendor({
    vendorId,
    customerName: 'John Doe',
    appointmentTime: '10:30 AM',
  });
  console.log('  → BOOKING_CANCELLED_VENDOR enqueued');

  await enqueueVendorWarning({
    vendorId,
    cancellationCount: 4,
  });
  console.log('  → VENDOR_WARNING enqueued');

  await enqueueVendorSuspended({
    vendorId,
    suspendReason: 'Exceeded cancellation limit',
  });
  console.log('  → VENDOR_SUSPENDED enqueued');

  await enqueueVendorReactivated({ vendorId });
  console.log('  → VENDOR_REACTIVATED enqueued');

  console.log('\n✅ All 7 jobs enqueued. Waiting 15s for worker to process them...');
}

async function verifyTokenPruning(userId: string, vendorId: string) {
  console.log('\n🔍 Verifying fake FCM token was pruned from DB...\n');

  const user = await UserModel.findById(userId, { fcmTokens: 1 }).lean();
  const vendor = await VendorModel.findById(vendorId, { fcmTokens: 1 }).lean();

  const userHasToken = user?.fcmTokens?.includes(FAKE_FCM_TOKEN);
  const vendorHasToken = vendor?.fcmTokens?.includes(FAKE_FCM_TOKEN);

  if (!userHasToken) {
    console.log('  ✅ User: fake token was pruned (FCM rejected + worker cleaned it up)');
  } else {
    console.log(
      '  ⚠️  User: fake token still present — worker may not have processed yet, or Firebase env is not configured',
    );
  }

  if (!vendorHasToken) {
    console.log('  ✅ Vendor: fake token was pruned');
  } else {
    console.log('  ⚠️  Vendor: fake token still present — check worker logs for Firebase errors');
  }
}

async function cleanup(userId: string, vendorId: string) {
  await UserModel.findByIdAndDelete(userId);
  await VendorModel.findByIdAndDelete(vendorId);
  console.log('\n🧹 Cleaned up test user and vendor from DB');
}

async function main() {
  console.log('='.repeat(60));
  console.log(' Felbo Notification Pipeline — End-to-End Test');
  console.log('='.repeat(60));
  console.log('\n⚠️  Make sure the notification worker is running in another terminal:');
  console.log('   npm run build && npm run worker:notifications\n');

  await connectMongo();

  const user = await seedTestUser();
  const vendor = await seedTestVendor();

  const userId = String(user._id);
  const vendorId = String(vendor._id);

  await enqueueAllJobs(userId, vendorId);

  // Give the worker time to process all jobs
  await wait(15_000);

  await verifyTokenPruning(userId, vendorId);
  await cleanup(userId, vendorId);

  await disconnectMongo();

  console.log('\n✅ Test complete. Check the worker terminal for job processing logs.');
  console.log('='.repeat(60));
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
