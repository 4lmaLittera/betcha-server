import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  handleCreateGroup,
  handleJoinGroup,
  handleGetMyGroups,
  handleGetGroupMembers,
} from '../controllers/groupController';

const router = Router();

router.post('/', requireAuth, handleCreateGroup);
router.post('/join', requireAuth, handleJoinGroup);
router.get('/', requireAuth, handleGetMyGroups);
router.get('/:id/members', requireAuth, handleGetGroupMembers);

export default router;
