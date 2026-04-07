import { Router } from 'express';
import { getProfile } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/profile', requireAuth as any, getProfile as any);

export default router;
