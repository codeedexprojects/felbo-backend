import { Router } from 'express';
import { categoryController } from '../../modules/category/category.container';
import { authorize } from '../../shared/middleware/authorize';
import { uploadController } from '../../modules/upload/upload.container';

const router = Router();

router.post(
  '/upload-url',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  uploadController.generateUploadUrl('categories/', false, 'images'),
);
router.post(
  '/verify-upload',
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  uploadController.verifyUpload('categories/', false, 'images'),
);

router.post('/', categoryController.create);
router.get('/', categoryController.getAllAdmin);
router.patch('/:categoryId', categoryController.update);
router.patch('/:categoryId/toggle', categoryController.toggleStatus);
router.delete('/:categoryId', categoryController.delete);

export default router;
