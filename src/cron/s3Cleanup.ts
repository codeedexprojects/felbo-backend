import cron from 'node-cron';
import { uploadService } from '../modules/upload/upload.container';
import { vendorService } from '../modules/vendor/vendor.container';
import { AdvertisementRepository } from '../modules/advertisement/advertisement.repository';
import { AvatarRepository } from '../modules/avatar/avatar.repository';
import { EventRepository } from '../modules/event/event.repository';
import { CategoryRepository } from '../modules/category/category.repository';
import UserRepository from '../modules/user/user.repository';
import { logger } from '../shared/logger/logger';

// All S3 prefixes where user-uploaded files live.
// tts/ is intentionally excluded — it has its own S3 lifecycle rule.
const UPLOAD_PREFIXES = [
  'vendors/',
  'advertisements/',
  'categories/',
  'events/',
  'avatars/',
  'users/',
];

const advertisementRepository = new AdvertisementRepository();
const avatarRepository = new AvatarRepository();
const eventRepository = new EventRepository();
const categoryRepository = new CategoryRepository();
const userRepository = new UserRepository();

async function collectAllStoredKeys(): Promise<Set<string>> {
  const extractKey = (url: string): string => new URL(url).pathname.slice(1);

  // vendorService.getAllPhotoKeys() already covers vendor docs + shop photos + barber photos
  const [vendorShopBarberKeys, adUrls, avatarKeys, eventUrls, categoryUrls, userUrls] =
    await Promise.all([
      vendorService.getAllPhotoKeys(),
      advertisementRepository.getAllPhotoUrls(),
      avatarRepository.getAllKeys(), // already raw S3 keys, no URL parsing needed
      eventRepository.getAllPhotoUrls(),
      categoryRepository.getAllPhotoUrls(),
      userRepository.getAllPhotoUrls(),
    ]);

  return new Set([
    ...vendorShopBarberKeys,
    ...adUrls.map(extractKey),
    ...avatarKeys,
    ...eventUrls.map(extractKey),
    ...categoryUrls.map(extractKey),
    ...userUrls.map(extractKey),
  ]);
}

async function runS3CleanupJob(): Promise<void> {
  logger.info({ action: 'S3_CLEANUP_JOB_STARTED', module: 'cron' });

  try {
    const dbKeys = await collectAllStoredKeys();
    const { deletedCount } = await uploadService.deleteOrphanedObjects(dbKeys, UPLOAD_PREFIXES);

    logger.info({
      action: 'S3_CLEANUP_JOB_COMPLETED',
      module: 'cron',
      deletedCount,
      trackedKeys: dbKeys.size,
    });
  } catch (err) {
    logger.error({
      action: 'S3_CLEANUP_JOB_FAILED',
      module: 'cron',
      error: (err as Error).message,
    });
  }
}

export function scheduleS3CleanupCron(): void {
  // Run once immediately on startup, then every Sunday at 03:00 IST
  void runS3CleanupJob();

  cron.schedule('0 3 * * 0', () => void runS3CleanupJob(), { timezone: 'Asia/Kolkata' });

  logger.info({
    action: 'S3_CLEANUP_CRON_SCHEDULED',
    module: 'cron',
    schedule: 'Sunday 03:00 IST',
  });
}
