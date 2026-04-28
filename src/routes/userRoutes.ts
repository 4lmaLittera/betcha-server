import { Router, RequestHandler } from 'express';
import { getProfile } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get(
  '/profile',
  requireAuth as RequestHandler,
  getProfile as RequestHandler,
);

export default router;
