import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { handleCreateTask, handleResolveTask } from '../controllers/taskController';

const router = Router();

router.post('/', requireAuth, handleCreateTask);
router.post('/:taskId/resolve', requireAuth, handleResolveTask);

export default router;
