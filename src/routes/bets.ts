import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { placeBet } from '../controllers/betsController';

const router = Router();

// POST /api/bets — sukurti naują statymą
router.post('/', requireAuth, placeBet);

export default router;
