import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { placeBet, getQuestBets } from '../controllers/betsController';

const router = Router();

// Sukuriame paprastą „in-memory“ srauto ribojimo sistemą be papildomų paketų
const betRequests = new Map<string, number[]>();

function betLimiter(req: Request, res: Response, next: NextFunction): void {
  // Susiejame su prisijungusio vartotojo ID arba IP
  const identifier =
    (req as AuthenticatedRequest).user?.id || req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 10 * 1000; // 10 sekundžių laikas
  const limit = 3; // Max 3 statymai per intervalą

  const userRequests = betRequests.get(identifier) || [];
  const recentRequests = userRequests.filter((time) => now - time < windowMs);

  if (recentRequests.length >= limit) {
    res.status(429).json({
      error: 'Too Many Requests',
      message:
        'Pristabdykite statymus. Bandykite dar kartą po kelių sekundžių.',
    });
    return;
  }

  recentRequests.push(now);
  betRequests.set(identifier, recentRequests);
  next();
}

// POST /api/bets — sukurti naują statymą
router.post('/', requireAuth, betLimiter, placeBet);

// GET /api/bets/quest/:questId - gauti užduoties lažybų agregaciją
router.get('/quest/:questId', requireAuth, getQuestBets);

export default router;
