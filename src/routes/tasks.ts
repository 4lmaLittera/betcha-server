import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { upload } from '../config/upload';
import {
  handleAssignTask,
  handleCreateTask,
  handleGetTaskById,
  handleResolveTask,
  handleSubmitEvidence,
} from '../controllers/taskController';

const router = Router();

router.post('/', requireAuth, handleCreateTask);
router.get('/:taskId', requireAuth, handleGetTaskById);
router.patch('/:taskId/assign', requireAuth, handleAssignTask);
router.post('/:taskId/resolve', requireAuth, handleResolveTask);
router.post(
  '/:taskId/evidence',
  requireAuth,
  upload.single('photo'),
  handleSubmitEvidence,
);

export default router;
