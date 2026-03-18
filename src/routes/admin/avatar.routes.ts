import { Router } from 'express';
import { avatarController } from '../../modules/avatar/avatar.container';
import { authorize } from '../../shared/middleware/authorize';
import { uploadController } from '../../modules/upload/upload.container';

const router = Router();

router.post(
  '/upload-url',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  uploadController.generateUploadUrl('avatars/'),
);

router.post(
  '/verify-upload',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  uploadController.verifyUpload('avatars/'),
);

router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), avatarController.listAvatars);

router.post('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), avatarController.addAvatar);

router.delete('/:id', authorize('SUPER_ADMIN', 'SUB_ADMIN'), avatarController.deleteAvatar);

export default router;
