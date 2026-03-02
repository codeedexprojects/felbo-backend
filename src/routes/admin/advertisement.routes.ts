import { Router } from 'express';
import { advertisementController } from '../../modules/advertisement/advertisement.container';
import { authorize } from '../../shared/middleware/authorize';
import { uploadController } from '../../modules/upload/upload.container';

const router = Router();

// Generate presigned S3 PUT URL and verify for admin banner image uploads
router.post(
  '/upload-url',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  uploadController.generateUploadUrl('advertisements/'),
);
router.post(
  '/verify-upload',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  uploadController.verifyUpload('advertisements/'),
);

router.post('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.createAd);
router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.listAds);
router.get('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.getAd);
router.put('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.updateAd);
router.delete('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), advertisementController.deleteAd);

export default router;
