import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { upload } from '../config/upload';
import { handleAnalyze } from '../controllers/analyzeController';

const router = Router();

router.post('/', requireAuth, upload.single('photo'), handleAnalyze);

export default router;
