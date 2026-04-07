import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { placeBet, getQuestBets } from '../controllers/betsController';

const router = Router();

// POST /api/bets — sukurti naują statymą
router.post('/', requireAuth, placeBet);

// GET /api/bets/quest/:questId - gauti užduoties lažybų agregaciją
router.get('/quest/:questId', requireAuth, getQuestBets);

export default router;
