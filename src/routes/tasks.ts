import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { handleCreateTask } from '../controllers/taskController';

const router = Router();

router.post('/', requireAuth, handleCreateTask);

export default router;
