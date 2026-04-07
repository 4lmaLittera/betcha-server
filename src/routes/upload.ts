import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { upload } from '../config/upload';
import { handleUpload } from '../controllers/uploadController';

const router = Router();

router.post('/', requireAuth, upload.single('photo'), handleUpload);

export default router;
