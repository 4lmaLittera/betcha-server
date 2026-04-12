import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { handleCreateGroup, handleJoinGroup } from '../controllers/groupController';

const router = Router();

router.post('/', requireAuth, handleCreateGroup);
router.post('/join', requireAuth, handleJoinGroup);

export default router;
