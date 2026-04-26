import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  handleCreateTask,
  handleGetTaskById,
  handleResolveTask,
} from '../controllers/taskController';

const router = Router();

router.post('/', requireAuth, handleCreateTask);
router.get('/:taskId', requireAuth, handleGetTaskById);
router.post('/:taskId/resolve', requireAuth, handleResolveTask);

export default router;
