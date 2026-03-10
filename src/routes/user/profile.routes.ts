import { Router } from 'express';
import { userController } from '../../modules/user/user.container';
import { uploadController } from '../../modules/upload/upload.container';

const router = Router();

router.get('/', userController.getProfile);
router.patch('/', userController.updateProfile);

router.post('/upload-url', uploadController.generateUploadUrl('users/', true, 'profile'));
router.post('/verify-upload', uploadController.verifyUpload('users/', true, 'profile'));

export default router;
