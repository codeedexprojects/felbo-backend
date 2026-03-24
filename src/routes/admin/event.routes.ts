import { Router } from 'express';
import { eventController } from '../../modules/event/event.container';
import { authorize } from '../../shared/middleware/authorize';
import { uploadController } from '../../modules/upload/upload.container';

const router = Router();

// Generate presigned S3 PUT URL and verify for event image uploads
router.post(
  '/upload-url',
  authorize('ASSOCIATION_ADMIN'),
  uploadController.generateUploadUrl('events/', false, 'banners'),
);

router.post(
  '/verify-upload',
  authorize('ASSOCIATION_ADMIN'),
  uploadController.verifyUpload('events/', false, 'banners'),
);

router.post('/', authorize('ASSOCIATION_ADMIN'), eventController.createEvent);
router.get('/', authorize('ASSOCIATION_ADMIN'), eventController.listEvents);
router.get('/:id', authorize('ASSOCIATION_ADMIN'), eventController.getEvent);
router.put('/:id', authorize('ASSOCIATION_ADMIN'), eventController.updateEvent);
router.delete('/:id', authorize('ASSOCIATION_ADMIN'), eventController.deleteEvent);

export default router;
