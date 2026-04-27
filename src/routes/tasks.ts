import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  handleAssignTask,
  handleCreateTask,
  handleGetTaskById,
  handleResolveTask,
} from '../controllers/taskController';

const router = Router();

router.post('/', requireAuth, handleCreateTask);
router.get('/:taskId', requireAuth, handleGetTaskById);
router.patch('/:taskId/assign', requireAuth, handleAssignTask);
router.post('/:taskId/resolve', requireAuth, handleResolveTask);

export default router;
